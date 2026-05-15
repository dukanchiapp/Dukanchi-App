/**
 * Local type shim for file-type@3.9.0 — Day 3 / Session 89 / Subtask 3.3.
 *
 * file-type v3.x is CommonJS and ships no `.d.ts` (DefinitelyTyped's
 * `@types/file-type` only covers v10+). v3.x exports a default function:
 *
 *   const fileType = require("file-type");
 *   fileType(buf); // → { ext: string; mime: string } | null
 *
 * v10+ migrated to named exports (`fromBuffer`, `fromStream`) — that API
 * is NOT in 3.x. Our codebase pins to 3.x via the existing transitive dep.
 *
 * If we ever upgrade to file-type ≥10, delete this file and install
 * `@types/file-type` or rely on the package's own bundled types.
 */
declare module "file-type" {
  interface FileTypeResult {
    ext: string;
    mime: string;
  }
  const fileType: (buf: Buffer | Uint8Array) => FileTypeResult | null;
  export default fileType;
}
