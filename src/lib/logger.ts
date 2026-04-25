import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // Redact fields that may contain sensitive data
  redact: {
    paths: [
      "password",
      "token",
      "*.password",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
      "body.password",
      "body.token",
      "body.jwt",
    ],
    censor: "[REDACTED]",
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});
