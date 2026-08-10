import jwt from 'jsonwebtoken'
import multer from 'multer'
import { ALLOWED_MIME_TYPES, AUTH_COOKIE_NAME, AUTH_COOKIE_SECURE, JWT_SECRET, UPLOAD_MAX_SIZE } from './config.js'
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

const authCookieOptions = {
  httpOnly: true,
  secure: AUTH_COOKIE_SECURE,
  sameSite: 'strict',
  path: '/',
}

function cookieValue(req, name) {
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue
    try { return decodeURIComponent(part.slice(separator + 1).trim()) } catch { return '' }
  }
  return ''
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, { ...authCookieOptions, maxAge: 8 * 60 * 60 * 1000 })
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions)
}

export async function authMiddleware(req, res, next) {
  try {
    const authorization = req.headers.authorization
    const parts = authorization?.split(' ')
    if (authorization && (parts?.length !== 2 || parts[0] !== 'Bearer' || !parts[1])) {
      return res.status(401).json({ message: '请先登录' })
    }
    const bearerToken = parts?.[1] || ''
    const token = bearerToken || cookieValue(req, AUTH_COOKIE_NAME)
    if (!token) return res.status(401).json({ message: '请先登录' })
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await one(
      'SELECT id, student_id AS studentId, name, role, status, class_name AS className FROM users WHERE id = ?',
      [payload.id]
    )
    if (!user || user.status !== 'active') return res.status(401).json({ message: '账号不存在或已停用' })
    if (bearerToken) setAuthCookie(res, bearerToken)
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
