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

  // Release tag — Day 4 / Session 90 / Edit 3; updated post-Fly migration.
  // Fly sets FLY_RELEASE_VERSION (and FLY_MACHINE_VERSION) automatically per
  // deploy; legacy RAILWAY_GIT_COMMIT_SHA stays in the chain as a harmless
  // no-op on Fly. npm_package_version is currently "0.0.0", so it only
  // serves as a placeholder for local dev. 'unknown' is the final fallback.
  // Lets us correlate a Sentry error to a specific deploy in the Sentry UI.
  const release =
    process.env.FLY_RELEASE_VERSION ||
    process.env.FLY_MACHINE_VERSION ||
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
