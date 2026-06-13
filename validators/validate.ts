import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import * as Sentry from '@sentry/node';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // Surface consent-gate 400s to Sentry so we can detect stale native
      // APK clients still shipping the pre-Legal-Phase-A signup payload
      // (no `consent` field). Other validation failures keep the original
      // behaviour — no Sentry event, no log noise.
      const hasConsentIssue = result.error.issues.some((i) =>
        i.path.some((p) => String(p) === 'consent'),
      );
      if (hasConsentIssue) {
        Sentry.captureMessage('signup.consent.missing', {
          level: 'warning',
          tags: { route: req.path, method: req.method },
          extra: { issues: result.error.issues },
        });
      }
      return res.status(400).json({ error: 'Validation failed', issues: result.error.issues });
    }
    req.body = result.data;
    return next();
  };
}

// Session 128.34: query + params validators mirror the body `validate()` above.
// On failure: 400 with the same { error, issues } shape. On success: merge the
// parsed (and zod-coerced) values back into req.query / req.params via
// Object.assign so downstream handlers see the typed/coerced values without
// us replacing the Express getter (Express 5 makes req.query read-only).
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', issues: result.error.issues });
    }
    Object.assign(req.query as Record<string, unknown>, result.data);
    return next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', issues: result.error.issues });
    }
    Object.assign(req.params as Record<string, unknown>, result.data);
    return next();
  };
}
