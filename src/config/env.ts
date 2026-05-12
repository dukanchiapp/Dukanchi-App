import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  // Password hashing cost factor — Day 3 / Session 89 / Subtask 3.4.
  // 12 is the 2026 production-ready default (~250ms per hash on modern hardware).
  // min(10) prevents accidental weakening; max(14) prevents runaway login latency.
  // bcrypt encodes the cost in every hash ($2b$XX$...), so bumping this value
  // is backwards-compatible — existing rounds-10 hashes continue to validate
  // via bcrypt.compare's per-hash cost auto-detection. No data migration needed.
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  // Optional plain strings — empty string ("") is treated as undefined for Railway compat
  ALLOWED_ORIGINS: z.string().optional().transform(v => v === '' ? undefined : v),
  ADMIN_PHONE: z.string().optional().transform(v => v === '' ? undefined : v),
  ADMIN_PASSWORD: z.string().optional().transform(v => v === '' ? undefined : v),
  AWS_REGION: z.string().optional().transform(v => v === '' ? undefined : v),
  AWS_ACCESS_KEY_ID: z.string().optional().transform(v => v === '' ? undefined : v),
  AWS_SECRET_ACCESS_KEY: z.string().optional().transform(v => v === '' ? undefined : v),
  S3_BUCKET_NAME: z.string().optional().transform(v => v === '' ? undefined : v),
  // Optional URL strings — .or() handles empty string before URL validation runs
  S3_ENDPOINT: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  R2_PUBLIC_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  SENTRY_DSN: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  VAPID_PUBLIC_KEY: z.string().optional().transform(v => v === '' ? undefined : v),
  VAPID_PRIVATE_KEY: z.string().optional().transform(v => v === '' ? undefined : v),
  VAPID_MAILTO: z.string().optional().transform(v => v === '' ? undefined : v),
  FIREBASE_ADMIN_KEY_JSON: z.string().optional().transform(v => v === '' ? undefined : v),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const env = _env.data;

export const getAllowedOrigins = (): string[] => {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  }
  // No env override: safe defaults by environment
  if (env.NODE_ENV === 'production') {
    return []; // Must be explicitly configured in production
  }
  return ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];
};

// Returns true if origin is an ngrok tunnel (dev only)
export const isNgrokOrigin = (origin: string): boolean => {
  if (process.env.NODE_ENV === 'production') return false;
  return (
    origin.includes('.ngrok-free.dev') ||
    origin.includes('.ngrok.io') ||
    origin.includes('.ngrok.app')
  );
};
