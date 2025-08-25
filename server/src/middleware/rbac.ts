import { Request, Response, NextFunction } from 'express'

/**
 * 简易 RBAC 中间件：
 * - 若携带有效 JWT，检查 user.role 是否在允许列表
 * - 若使用 X-API-Key（系统访问），默认放行（视为 ADMIN）
 */
export function requireRoles(...roles: Array<'ADMIN' | 'OP' | 'VIEWER'>) {
  return (req: Request & { user?: { role?: string } }, res: Response, next: NextFunction) => {
    const apiKey = req.header('X-API-Key')
    const expected = process.env.API_KEY || 'dev-api-key'
    if (apiKey && apiKey === expected) return next()

    const role = req.user?.role
    if (!role) return res.status(401).json({ message: 'unauthorized' })
    if (roles.includes(role as any)) return next()
    return res.status(403).json({ message: 'forbidden' })
  }
}
