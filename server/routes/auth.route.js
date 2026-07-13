import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb, genId, saveDb } from '../db.js'
import { JWT_SECRET } from '../config.js'

const router = Router()

router.post('/register', (req, res) => {
  const { studentId, name, password } = req.body
  if (!studentId || !name || !password) {
    return res.status(400).json({ message: '学号、姓名和密码不能为空' })
  }
  if (password.length < 6) {
    return res.status(400).json({ message: '密码至少6位' })
  }

  const existing = getDb().exec('SELECT 1 FROM users WHERE student_id = ?', [studentId])
  if (existing[0] && existing[0].values.length) {
    return res.status(400).json({ message: '该学号已注册' })
  }

  const id = genId()
  const hash = bcrypt.hashSync(password, 10)
  getDb().run('INSERT INTO users (id, student_id, name, password_hash) VALUES (?, ?, ?, ?)', [id, studentId, name, hash])
  saveDb()

  const user = { id, studentId, name, role: 'student' }
  const token = jwt.sign({ id: user.id, studentId: user.studentId, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ code: 0, data: { token, user } })
})

router.post('/login', (req, res) => {
  const { studentId, password } = req.body
  if (!studentId || !password) {
    return res.status(400).json({ message: '学号和密码不能为空' })
  }

  const rows = getDb().exec('SELECT id, student_id, name, role, password_hash FROM users WHERE student_id = ?', [studentId])
  if (!rows[0] || !rows[0].values.length) {
    return res.status(400).json({ message: '学号未注册' })
  }

  const row = rows[0].values[0]
  const hash = row[4]

  if (!hash) {
    return res.status(400).json({ message: '该账号未设置密码，请联系管理员重置' })
  }
  if (bcrypt.compareSync(password, hash)) {
    const user = { id: row[0], studentId: row[1], name: row[2], role: row[3] }
    const token = jwt.sign({ id: user.id, studentId: user.studentId, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ code: 0, data: { token, user } })
  }

  res.status(400).json({ message: '密码错误' })
})

router.post('/logout', (req, res) => {
  res.json({ code: 0, data: null })
})

export default router
