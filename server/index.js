import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import rateLimit from 'express-rate-limit'
import { closeDb, initDb, one } from './db.js'
import { DIST_DIR, NODE_ENV, PORT, STORAGE_CONFIG, UPLOADS_DIR, validateRuntimeConfig } from './config.js'
import { getAiLoad } from './services/aiLimiter.js'
import { initStorage } from './services/storage.js'
import authRoutes from './routes/auth.route.js'
import conversationRoutes from './routes/conversations.route.js'
import chatRoutes from './routes/chat.route.js'
import uploadRoutes from './routes/upload.route.js'
import linkParseRoutes from './routes/linkParse.route.js'
import submissionRoutes from './routes/submissions.route.js'
import caseRoutes from './routes/cases.route.js'
import diaryRoutes from './routes/diaries.route.js'
import adminRoutes from './routes/admin.route.js'

const app = express()
validateRuntimeConfig()
app.set('trust proxy', 1)

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').filter(Boolean)
  : NODE_ENV === 'production' ? false : true
app.use(cors({ origin: corsOrigin }))
app.use(express.json({ limit: '2mb' }))

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  next()
})

if (STORAGE_CONFIG.driver === 'local') {
  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: NODE_ENV === 'production' ? '7d' : 0 }))
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/auth/login', loginLimiter)

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', apiLimiter)

app.get('/api/health', async (_req, res) => {
  const database = await one('SELECT 1 AS healthy')
  res.json({ status: 'ok', database: Boolean(database?.healthy), ai: getAiLoad(), timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/parse-link', linkParseRoutes)
app.use('/api/submissions', submissionRoutes)
app.use('/api/cases', caseRoutes)
app.use('/api/diaries', diaryRoutes)
app.use('/api/admin', adminRoutes)

if (NODE_ENV === 'production' && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: '1h', index: false }))
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) return res.sendFile('index.html', { root: DIST_DIR })
    next()
  })
}

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: '文件大小超过限制' })
  res.status(500).json({ message: NODE_ENV === 'production' ? '服务器内部错误' : error.message })
})

await initStorage()
await initDb()
const server = app.listen(PORT, () => console.log(`后端服务已启动: http://localhost:${PORT}`))

async function shutdown(signal) {
  console.log(`收到 ${signal}，正在安全关闭服务`)
  server.close(async () => {
    await closeDb()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
