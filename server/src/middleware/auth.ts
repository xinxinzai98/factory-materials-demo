import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthUser { id: string; username: string; role: string }

export function authGuard() {
  return (req: Request & { user?: AuthUser }, res: Response, next: NextFunction) => {
    const apiKey = req.header('X-API-Key')
    const expected = process.env.API_KEY || 'dev-api-key'
    const authz = req.header('Authorization')

    if (apiKey && apiKey === expected) return next()

    if (authz && authz.startsWith('Bearer ')) {
      const token = authz.slice(7)
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret') as AuthUser
        req.user = payload
        return next()
      } catch (e) {
        return res.status(401).json({ message: 'invalid token' })
      }
    }
    return res.status(401).json({ message: 'unauthorized' })
  }
}
