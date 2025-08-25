import { Request, Response, NextFunction } from 'express';

export function apiKeyGuard(expectedKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('X-API-Key') || req.header('x-api-key');
    if (!expectedKey) return next(); // dev fallback
    if (key !== expectedKey) {
      return res.status(401).json({ message: 'Invalid API key' });
    }
    next();
  };
}
