import { Router, Request, Response } from 'express'
import { AppDataSource } from '../data-source.js'
import { User } from '../entities/User.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const router = Router()

// 开发用：注册用户
router.post('/register', async (req: Request, res: Response) => {
  const { username, password, role } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'username/password required' })
  const repo = AppDataSource.getRepository(User)
  const exist = await repo.findOne({ where: { username } })
  if (exist) return res.status(409).json({ message: 'username exists' })
  const passwordHash = await bcrypt.hash(password, 10)
  const user = repo.create({ username, passwordHash, role: role || 'ADMIN' })
  await repo.save(user)
  res.status(201).json({ id: user.id, username: user.username, role: user.role })
})

// 登录
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'username/password required' })
  const repo = AppDataSource.getRepository(User)
  const user = await repo.findOne({ where: { username, enabled: true } })
  if (!user) return res.status(401).json({ message: 'invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ message: 'invalid credentials' })
  const payload = { id: user.id, username: user.username, role: user.role }
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-jwt-secret', { expiresIn: '8h' })
  res.json({ token, user: payload })
})

// 获取当前用户（需 Bearer 或 API Key）
router.get('/me', (req: Request, res: Response) => {
  const authz = req.header('Authorization')
  if (authz?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authz.slice(7), process.env.JWT_SECRET || 'dev-jwt-secret')
      return res.json({ user: payload })
    } catch {
      return res.status(401).json({ message: 'invalid token' })
    }
  }
  return res.status(200).json({ user: null })
})

export default router
