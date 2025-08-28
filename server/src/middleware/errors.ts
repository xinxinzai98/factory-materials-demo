import { NextFunction, Request, Response } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'ERR_VALIDATION'
  | 'ERR_NOT_FOUND'
  | 'ERR_CONFLICT'
  | 'ERR_DUPLICATE_CODE'
  | 'ERR_INVALID_STATUS'
  | 'ERR_INSUFFICIENT_STOCK'
  | 'ERR_IDEMPOTENT_REPLAY'
  | 'ERR_INTERNAL';

export class AppError extends Error {
  status: number;
  code: ErrorCode;
  details?: any;
  constructor(code: ErrorCode, message?: string, status?: number, details?: any) {
    super(message || code);
    this.code = code;
    this.status = status || StatusCodes.BAD_REQUEST;
    this.details = details;
  }
}

export function mapError(err: any): { status: number; body: any } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { code: err.code, message: err.message, details: err.details },
    };
  }
  if (err instanceof ZodError) {
    return {
      status: StatusCodes.UNPROCESSABLE_ENTITY,
      body: { code: 'ERR_VALIDATION', message: '请求参数校验失败', details: err.flatten() },
    };
  }
  const msg = (typeof err?.message === 'string' && err.message) || String(err);
  // Heuristics from existing throws
  if (msg.includes('not found')) {
    return { status: StatusCodes.NOT_FOUND, body: { code: 'ERR_NOT_FOUND', message: msg } };
  }
  if (msg.includes('duplicate code')) {
    return { status: StatusCodes.CONFLICT, body: { code: 'ERR_DUPLICATE_CODE', message: msg } };
  }
  if (msg.includes('invalid status')) {
    return { status: StatusCodes.CONFLICT, body: { code: 'ERR_INVALID_STATUS', message: msg } };
  }
  if (msg.includes('insufficient stock')) {
    return { status: StatusCodes.CONFLICT, body: { code: 'ERR_INSUFFICIENT_STOCK', message: msg } };
  }
  return {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    body: { code: 'ERR_INTERNAL', message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR) },
  };
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const mapped = mapError(err);
  res.status(mapped.status).json(mapped.body);
}

export function errorResponse(res: Response, err: any) {
  const mapped = mapError(err);
  return res.status(mapped.status).json(mapped.body);
}
