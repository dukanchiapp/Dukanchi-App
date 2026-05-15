/**
 * Test app factory — Day 2.7 / Session 91 / Phase 1 infrastructure.
 *
 * Builds a minimal Express app for HTTP integration tests via supertest.
 * Each test mounts ONLY the routes / middleware under test — avoids the
 * cost (and mocking complexity) of importing the full src/app.ts which
 * pulls in Sentry init, Redis client, rate-limiter, pinoHttp, etc.
 *
 * For tests that need rate-limiter / pino / Sentry behavior, mount those
 * pieces explicitly via the `with*` helpers below.
 *
 * Pattern reference: src/middlewares/auth.middleware.test.ts — that file
 * tests middleware as a pure function; this helper extends the pattern to
 * "mount middleware in a real Express app + use supertest" without
 * full-app overhead.
 */
import express, { type Express, type Router } from "express";
import cookieParser from "cookie-parser";

export interface MakeTestAppOptions {
  /**
   * Routers to mount on the app, keyed by mount path.
   * Example: { "/api/auth": authRoutes }
   */
  routes?: Record<string, Router>;

  /**
   * JSON body limit. Defaults to '1mb' (matches production global default
   * from Day 3.2). Override for AI-route tests (e.g., '10mb').
   */
  bodyLimit?: string;

  /**
   * Whether to install cookie-parser. Defaults to true (most auth tests
   * need it). Set false for stateless API tests where cookies are not
   * relevant.
   */
  withCookieParser?: boolean;

  /**
   * Custom middleware to apply BEFORE the routes (e.g., a fake auth
   * middleware that attaches req.user). Runs after body parsers + cookies.
   */
  middleware?: express.RequestHandler[];

  /**
   * Whether to install the production-style 413 JSON error handler from
   * src/app.ts section 11b. Lets body-limit tests verify the typed JSON
   * response instead of the default Express plain-text error.
   */
  withPayloadTooLargeHandler?: boolean;
}

export function makeTestApp(opts: MakeTestAppOptions = {}): Express {
  const app = express();

  const limit = opts.bodyLimit ?? "1mb";
  app.use(express.json({ limit }));
  app.use(express.urlencoded({ limit, extended: true }));
  if (opts.withCookieParser !== false) app.use(cookieParser());

  for (const mw of opts.middleware ?? []) {
    app.use(mw);
  }

  for (const [mountPath, router] of Object.entries(opts.routes ?? {})) {
    app.use(mountPath, router);
  }

  if (opts.withPayloadTooLargeHandler) {
    // Mirrors src/app.ts section 11b (Day 3.2). Express requires the
    // 4-arg signature on error-handling middleware — TypeScript doesn't
    // enforce it but Express's dispatcher checks function.length === 4.
    app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err && (err.type === "entity.too.large" || err.status === 413 || err.statusCode === 413)) {
        return res.status(413).json({
          error: "Payload too large",
          code: "PAYLOAD_TOO_LARGE",
          limit: err.limit,
        });
      }
      return next(err);
    });
  }

  return app;
}
