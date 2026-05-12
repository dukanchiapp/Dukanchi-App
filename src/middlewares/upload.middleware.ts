import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// Imported from @aws-sdk/client-s3 transitive dep — explicit install not required.
// Provides connection/socket/request timeout control for the S3 SDK
// (Subtask 3.5 — closes the "unbounded R2 upload" worker-pile-up vector).
import { NodeHttpHandler } from "@smithy/node-http-handler";
import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import _fileType from "file-type";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * Upload middleware — Day 3 / Session 89 / Subtask 3.3 (production-grade upload validation).
 *
 * Hardening summary:
 *   - memory storage (multer.memoryStorage()) so we can magic-byte verify
 *     BEFORE the file lands in durable storage
 *   - fileSize cap: 10MB per file (matches nginx 20MB ceiling with headroom)
 *   - MIME whitelist for image endpoints (jpeg, png, webp, gif — SVG
 *     explicitly excluded to close XSS-via-SVG surface)
 *   - filename sanitization in fileFilter (basename only, no dot-leading,
 *     no control chars, no double-extensions, [a-zA-Z0-9._-] only, ≤200 chars)
 *   - magic-byte verification post-multer via file-type@3.9.0
 *     (verifies first ~4KB of file content matches the claimed MIME — closes
 *     the MIME-spoofing surface where attacker uploads `evil.exe` as image/jpeg)
 *   - DETECTED MIME (not claimed) used as the stored Content-Type on R2 —
 *     prevents downstream services from trusting a forged label
 *   - storage-key includes Date.now() + 8 random bytes + safe basename —
 *     collision-resistant + unguessable
 *
 * Frontend contract: every /api/upload caller sends `<input accept="image/*">`.
 * Backend now enforces it. The Excel bulk-import endpoint has its own
 * separate xlsUpload Multer (left untouched in this session).
 */

// file-type@3.9.0 ships no .d.ts and exports a default function (no
// `fromBuffer` named export — that's v10+). Cast at the boundary.
const fileType = _fileType as unknown as (
  buf: Buffer,
) => { ext: string; mime: string } | null;

// ── Constants ───────────────────────────────────────────────────────────────
export const IMAGE_MIME_WHITELIST: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const FILE_SIZE_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB
const MAGIC_BYTE_PEEK = 4100; // sufficient for all formats we accept
const MAX_BASENAME_LENGTH = 200;

// ── S3 client (production R2 path) ──────────────────────────────────────────
// requestHandler enforces Subtask 3.5 timeouts:
//   - connectionTimeout:  5s  — fail fast if R2 endpoint unreachable
//   - socketTimeout:     60s  — accommodates large uploads over slow mobile
//   - requestTimeout:    60s  — total per-request ceiling
//   - throwOnRequestTimeout: true — convert breach into a TimeoutError (otherwise
//     it's logged as a warning only; we want the handler to surface 500 PERSIST_FAILED)
const s3Client = env.S3_BUCKET_NAME
  ? new S3Client({
      region: env.AWS_REGION || "auto",
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY || "",
      },
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
        socketTimeout: 60_000,
        requestTimeout: 60_000,
        throwOnRequestTimeout: true,
      }),
    })
  : null;

// ── Local disk fallback (dev) ───────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads");
if (!s3Client) {
  // Module-load-time sync mkdir: cheap, only runs in dev without S3 configured.
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Filename sanitization ───────────────────────────────────────────────────
/**
 * Sanitize a user-supplied filename. Throws Error with code='INVALID_FILENAME'
 * on patterns we refuse to accept (defense vs path-traversal / hidden-file /
 * double-extension / control-char attacks). On success returns a safe basename.
 */
function sanitizeFilename(rawName: string): string {
  const base = path.basename(rawName);

  if (!base || base === "." || base === "..") {
    const err = new Error("Empty or invalid filename");
    (err as any).code = "INVALID_FILENAME";
    throw err;
  }
  if (base.startsWith(".")) {
    const err = new Error("Hidden filenames not allowed");
    (err as any).code = "INVALID_FILENAME";
    throw err;
  }
  // Control chars (incl. NUL) — Buffer.from('a\0b').length is 3 in JS but
  // many storage systems treat NUL as terminator. Hard reject.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(base)) {
    const err = new Error("Filename contains control characters");
    (err as any).code = "INVALID_FILENAME";
    throw err;
  }
  // Double extension (file.php.jpg) — classic polyglot smuggling.
  const dotCount = (base.match(/\./g) || []).length;
  if (dotCount > 1) {
    const err = new Error("Multiple extensions not allowed");
    (err as any).code = "INVALID_FILENAME";
    throw err;
  }
  // Replace anything outside [a-zA-Z0-9._-] with underscore.
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, MAX_BASENAME_LENGTH);
}

// ── Multer config — memory storage so magic-byte check has the buffer ──────
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_SIZE_LIMIT_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // First gate: claimed MIME must be in the whitelist (cheap pre-check —
    // magic-byte verification post-multer is the authoritative one).
    if (!IMAGE_MIME_WHITELIST.has(file.mimetype)) {
      const err = new Error(`MIME ${file.mimetype} not allowed`);
      (err as any).code = "INVALID_MIME";
      return cb(err);
    }
    // Second gate: filename sanity-check upfront so we fail before reading bytes.
    try {
      sanitizeFilename(file.originalname);
    } catch (err) {
      return cb(err as Error);
    }
    return cb(null, true);
  },
});

// ── Post-multer middleware: verify magic bytes + persist ────────────────────
/**
 * Run AFTER `upload.single(field)` (or .array, .fields). Verifies the actual
 * file content against the claimed MIME via magic-byte inspection, then
 * persists to S3 (production) or disk (dev). Sets req.file.key /
 * req.file.filename so the existing getUploadedFileUrl helper continues to
 * work without changes to route handlers.
 *
 * If no file is on the request (e.g., handler is multipart-with-text-only),
 * passes through silently — handler decides whether that's an error.
 *
 * Rule B: every rejection branch logs via pino with structured context.
 */
export async function verifyAndPersistUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    return next();
  }

  // Magic-byte inspection — first 4KB of buffer is plenty for our formats.
  const peek = file.buffer.subarray(0, Math.min(MAGIC_BYTE_PEEK, file.buffer.length));
  const detected = fileType(peek);

  if (!detected || !IMAGE_MIME_WHITELIST.has(detected.mime)) {
    logger.warn(
      {
        claimed: file.mimetype,
        detected: detected?.mime ?? null,
        originalname: file.originalname,
        size: file.size,
      },
      "Upload rejected: magic-byte not in image whitelist",
    );
    res.status(415).json({
      error: "File content does not match declared type",
      code: "MIME_MISMATCH",
    });
    return;
  }

  if (detected.mime !== file.mimetype) {
    logger.warn(
      { claimed: file.mimetype, detected: detected.mime, originalname: file.originalname },
      "Upload rejected: claimed MIME differs from content",
    );
    res.status(415).json({
      error: "File content does not match declared type",
      code: "MIME_MISMATCH",
    });
    return;
  }

  // sanitizeFilename already ran in fileFilter; calling again is defense-in-depth
  // and gives us the safe base name to use as part of the storage key.
  let safeBase: string;
  try {
    safeBase = sanitizeFilename(file.originalname);
  } catch (err: any) {
    logger.warn({ originalname: file.originalname, message: err.message }, "Upload rejected at sanitize");
    res.status(400).json({ error: err.message, code: "INVALID_FILENAME" });
    return;
  }

  // Storage key — use DETECTED extension (not the user's claim).
  const detectedExt = "." + detected.ext;
  const random = crypto.randomBytes(8).toString("hex");
  const baseNoExt = path.basename(safeBase, path.extname(safeBase));
  const storageKey = `${Date.now()}-${random}-${baseNoExt}${detectedExt}`;

  try {
    if (s3Client && env.S3_BUCKET_NAME) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: storageKey,
          Body: file.buffer,
          ContentType: detected.mime, // DETECTED, not claimed — trust the bytes
        }),
      );
      // Shape mirrors multer-s3's previous output so getUploadedFileUrl unchanged.
      (file as any).key = storageKey;
      (file as any).location = env.R2_PUBLIC_URL
        ? `${env.R2_PUBLIC_URL}/${storageKey}`
        : `s3://${env.S3_BUCKET_NAME}/${storageKey}`;
    } else {
      const diskPath = path.join(uploadDir, storageKey);
      await fsp.writeFile(diskPath, file.buffer);
      // Shape mirrors multer.diskStorage previous output.
      (file as any).filename = storageKey;
      (file as any).path = diskPath;
      (file as any).destination = uploadDir;
    }
    return next();
  } catch (err) {
    logger.error({ err, storageKey }, "Upload persist failed");
    res.status(500).json({ error: "Failed to save upload", code: "PERSIST_FAILED" });
    return;
  }
}

/**
 * Returns the public URL for an uploaded file. UNCHANGED behavior from
 * pre-Day-3 — reads from the shape verifyAndPersistUpload sets on req.file.
 */
export function getUploadedFileUrl(file: Express.Multer.File): string {
  const f = file as any;
  if (f.key && env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL}/${f.key}`;
  }
  return f.location ?? `/uploads/${f.filename}`;
}

// Re-export for tests
export { sanitizeFilename };
