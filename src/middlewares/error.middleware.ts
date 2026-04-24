import { Request, Response, NextFunction } from "express";

export const fallthroughErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // The error id is attached to `res.sentry` by the Sentry middleware
  res.statusCode = 500;
  res.end((res as any).sentry ? (res as any).sentry + "\n" : "Internal Server Error\n");
};
