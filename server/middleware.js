import jwt from 'jsonwebtoken'
import multer from 'multer'
import { JWT_SECRET, UPLOAD_MAX_SIZE, ALLOWED_MIME_TYPES } from './config.js'
import { one } from './db.js'

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_SIZE },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype)),
})

export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

export async function authMiddleware(req, res, next) {
  try {
    const parts = req.headers.authorization?.split(' ')
    if (parts?.[0] !== 'Bearer' || !parts[1]) return res.status(401).json({ message: '请先登录' })
    const token = parts[1]
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await one(
      'SELECT id, student_id AS studentId, name, role, status, class_name AS className FROM users WHERE id = ?',
      [payload.id]
    )
    if (!user || user.status !== 'active') return res.status(401).json({ message: '账号不存在或已停用' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: '登录已过期，请重新登录' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: '仅管理员可执行此操作' })
  next()
}
