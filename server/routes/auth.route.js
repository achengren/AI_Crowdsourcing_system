import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { one, query } from '../db.js'
import { JWT_SECRET } from '../config.js'
import { authMiddleware } from '../middleware.js'

const router = Router()
const loginSchema = z.object({ studentId: z.string().trim().min(1), password: z.string().min(1) })

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '账号和密码不能为空' })

  const row = await one(
    'SELECT id, student_id AS studentId, name, role, status, class_name AS className, password_hash AS passwordHash FROM users WHERE student_id = ?',
    [parsed.data.studentId]
  )
  if (!row || !bcrypt.compareSync(parsed.data.password, row.passwordHash) || row.status !== 'active') {
    return res.status(400).json({ message: '账号或密码错误' })
  }

  await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [row.id])
  const user = {
    id: row.id,
    studentId: row.studentId,
    name: row.name,
    role: row.role,
    className: row.className,
  }
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '8h' })
  res.json({ code: 0, data: { token, user } })
})

router.get('/me', authMiddleware, (req, res) => res.json({ code: 0, data: req.user }))

router.post('/change-password', authMiddleware, async (req, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '新密码至少 8 位' })
  const row = await one('SELECT password_hash AS passwordHash FROM users WHERE id = ?', [req.user.id])
  if (!bcrypt.compareSync(parsed.data.currentPassword, row.passwordHash)) {
    return res.status(400).json({ message: '当前密码错误' })
  }
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(parsed.data.newPassword, 12), req.user.id])
  res.json({ code: 0, data: null })
})

router.post('/logout', (_req, res) => res.json({ code: 0, data: null }))

export default router
