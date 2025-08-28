import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { AppError } from './errors.js';

export async function ensureIdempotency(req: Request, _res: Response, next: NextFunction) {
  // 仅对可能产生副作用的方法启用；且仅当客户端提供键时
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
  const key = (req.header('Idempotency-Key') || req.header('x-idempotency-key') || '').trim();
  if (!key) return next();
  // 统一幂等键路径（不含查询串）
  const path = (req.baseUrl || '') + (req.path || '');
  try {
    const rows = await AppDataSource.query(
      `INSERT INTO idempotency_keys(key, method, path, "createdAt") VALUES($1,$2,$3,NOW()) ON CONFLICT (key, method, path) DO NOTHING RETURNING 1`,
      [key, method, path]
    );
    if (rows.length === 0) throw new AppError('ERR_IDEMPOTENT_REPLAY', '重复的幂等键请求', 409);
    next();
  } catch (e) {
    return next(e);
  }
}
