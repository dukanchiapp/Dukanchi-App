import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logger } from "./logger";

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn("SENTRY_DSN not set — Sentry error tracking is disabled.");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  // Release tag — Day 4 / Session 90 / Edit 3.
  // Railway exposes RAILWAY_GIT_COMMIT_SHA at runtime; fall back to the
  // package.json version (npm injects npm_package_version), then 'unknown'.
  // Lets us correlate a Sentry error to a specific deploy in the Sentry UI.
  const release =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    'unknown';

  Sentry.init({
    dsn,
    release,
    environment: process.env.NODE_ENV || "development",
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: isProduction ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip auth headers and cookies to avoid leaking tokens into Sentry
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  logger.info({ sentryEnv: process.env.NODE_ENV, release }, "Sentry initialized");
}
