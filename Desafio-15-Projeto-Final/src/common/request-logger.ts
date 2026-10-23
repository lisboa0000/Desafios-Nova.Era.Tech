import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestLogger(enabled: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
    res.setHeader('x-request-id', requestId);
    if (!enabled) return next();
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(
        JSON.stringify({
          time: new Date().toISOString(),
          service: 'marketplace-api',
          level: res.statusCode >= 500 ? 'error' : 'info',
          requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
        }),
      );
    });
    next();
  };
}
