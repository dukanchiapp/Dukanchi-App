import * as Sentry from "@sentry/node";
import { logger } from "./logger";

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn("SENTRY_DSN not set — Sentry error tracking is disabled.");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    sendDefaultPii: false, // Never send PII like IPs or request bodies
  });

  logger.info({ sentryEnv: process.env.NODE_ENV }, "Sentry initialized");
}
