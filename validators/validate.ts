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
