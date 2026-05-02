import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import path from "path";
import fs from "fs";
import { env } from "../config/env";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

let upload: multer.Multer;

if (env.S3_BUCKET_NAME) {
  const s3 = new S3Client({
    region: env.AWS_REGION || "auto",
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: env.S3_BUCKET_NAME,
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        cb(null, Date.now().toString() + "-" + file.originalname);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
  });
} else {
  upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + ext);
      },
    }),
  });
}

/**
 * Returns the public URL for an uploaded file.
 * Prefers R2_PUBLIC_URL+key over multer-s3's .location (which points to the private endpoint).
 */
export function getUploadedFileUrl(file: Express.Multer.File): string {
  const f = file as any;
  if (f.key && env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL}/${f.key}`;
  }
  return f.location ?? `/uploads/${file.filename}`;
}

export { upload };
