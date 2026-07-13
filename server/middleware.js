import jwt from 'jsonwebtoken'
import multer from 'multer'
import path from 'node:path'
import { JWT_SECRET, UPLOADS_DIR, UPLOAD_MAX_SIZE, ALLOWED_MIME_TYPES } from './config.js'
import { genId } from './db.js'

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `${genId()}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype))
  },
})

export function authMiddleware(req, res, next) {
  if (req.headers.authorization === 'Bearer guest') {
    req.user = { id: 'guest', name: '游客', role: 'guest' }
    return next()
  }
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ message: '请先登录' })
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: '登录已过期，请重新登录' })
  }
}

export function optionalAuth(req, res, next) {
  if (req.headers.authorization === 'Bearer guest') {
    req.user = { id: 'guest', name: '游客', role: 'guest' }
    return next()
  }
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      req.user = jwt.verify(token, JWT_SECRET)
    }
  } catch {
    // token 无效，以匿名身份继续
  }
  next()
}
