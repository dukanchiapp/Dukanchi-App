/**
 * CSP violation report endpoint.
 *
 * Browsers POST here when a page load (or runtime resource fetch) violates
 * the Content-Security-Policy header configured in src/app.ts. While we run
 * CSP in Report-Only mode, EVERY would-be block hits this endpoint instead
 * of breaking the page — we use that to tune directives before flipping to
 * enforcement.
 *
 * Wire-up notes:
 *   - Mounted at /api/csp-report from src/app.ts BEFORE the global
 *     /api rate limiter (CSP reports must always succeed; we apply our own
 *     limiter scoped to this endpoint instead).
 *   - Uses its own body parser for application/csp-report (Chrome) and
 *     application/json (Firefox / spec-compliant). Limit 10KB — CSP reports
 *     are tiny (typically <1KB).
 *   - Rate limit: 100/min/IP. A misbehaving page or extension can flood
 *     reports; 100/min protects the Sentry quota and our log volume while
 *     leaving plenty of headroom for legitimate violations during dev.
 *   - Always returns 204 No Content. Per the CSP spec + Chrome's quirks,
 *     ANY 4xx/5xx response causes the browser to stop sending reports for
 *     that document — we'd lose telemetry. Even on parse failure we 204.
 *
 * Why we don't use captureException: violations are NOT exceptions in our
 * code — they're informational telemetry about external pages / extensions
 * trying to load resources we don't allow. We emit a Sentry message
 * (captureMessage, level=warning) with tags so they group in the Sentry UI
 * by directive + blocked origin.
 */
import { Router } from "express";
import express from "express";
import * as Sentry from "@sentry/node";
import rateLimit from "express-rate-limit";
import { logger } from "../../lib/logger";

const router = Router();

// Chrome sends application/csp-report; Firefox + spec send application/json.
// Accept both so we don't drop reports from either engine.
const cspReportParser = express.json({
  type: ["application/csp-report", "application/json"],
  limit: "10kb",
});

// In-memory limiter (no Redis store): CSP reports are non-critical
// observability data, and per-machine 100/min/IP is acceptable even with
// horizontal scaling. Redis would add a dependency for no benefit.
const cspReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: false,
  legacyHeaders: false,
});

router.post(
  "/csp-report",
  cspReportLimiter,
  cspReportParser,
  (req, res) => {
    try {
      // Both schema variants:
      //   { "csp-report": { ...fields } }            ← legacy (Chrome)
      //   { ...fields }                              ← spec / Firefox
      const report = (req.body && req.body["csp-report"]) || req.body || {};

      Sentry.addBreadcrumb({
        category: "csp_violation",
        level: "warning",
        data: {
          blocked_uri: report["blocked-uri"],
          violated_directive: report["violated-directive"],
          document_uri: report["document-uri"],
          source_file: report["source-file"],
          line_number: report["line-number"],
          user_agent: req.headers["user-agent"],
        },
      });

      Sentry.captureMessage("CSP violation", {
        level: "warning",
        tags: {
          csp_directive: report["violated-directive"] || "unknown",
          csp_blocked_origin: report["blocked-uri"] || "unknown",
        },
      });

      logger.warn({ report }, "CSP violation reported");
    } catch (err) {
      // Don't let processing errors fail the response — Chrome will stop
      // sending reports for the document if it sees a 4xx/5xx. Log + 204.
      logger.error({ err }, "Failed to process CSP report");
      Sentry.captureException(err, { extra: { context: "csp-report.handler" } });
    }

    return res.status(204).send();
  },
);

export default router;
