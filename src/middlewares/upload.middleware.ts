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

if (env.AWS_S3_BUCKET) { // assuming process.env.S3_BUCKET_NAME maps to AWS_S3_BUCKET
  const s3 = new S3Client({
    region: env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY || "",
    }
  });
  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: env.AWS_S3_BUCKET,
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        cb(null, Date.now().toString() + "-" + file.originalname);
      }
    })
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

export { upload };
