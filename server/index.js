import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import 'dotenv/config'
import OpenAI from 'openai'
import { parseLink } from './linkParser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JWT_SECRET = 'ai-crowdsourcing-secret-key-2024'
const DB_PATH = path.join(__dirname, 'data.db')
const PORT = 3001

const genId = () => crypto.randomBytes(16).toString('hex')

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

// Ollama 视觉模型客户端（Qwen3-VL-8B 识图）
const ollama = new OpenAI({
  baseURL: 'http://162.105.154.176:11434/v1',
  apiKey: 'ollama',
})

// 解析消息中的图片前缀 [image:/uploads/xxx.png]\n
function parseImageContent(raw) {
  const m = raw.match(/^\[image:(.+?)\]\n/)
  if (m) {
    return { imageUrl: m[1], text: raw.slice(m[0].length) }
  }
  return { imageUrl: null, text: raw }
}

function readImageAsBase64(imageUrl) {
  const filePath = path.join(__dirname, imageUrl)
  const buffer = fs.readFileSync(filePath)
  const base64 = buffer.toString('base64')
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const mime = ext === 'jpg' ? 'jpeg' : ext
  return `data:image/${mime};base64,${base64}`
}

let db

let saveTimer = null

function saveDb() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFile(DB_PATH, Buffer.from(db.export()), (err) => {
      if (err) console.error('数据库保存失败:', err)
    })
  }, 200)
}

function saveDbNow() {
  clearTimeout(saveTimer)
  try {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
  } catch (err) {
    console.error('数据库同步保存失败:', err)
  }
}

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

async function initDb() {
  const SQL = await initSqlJs()

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buffer)
    // 迁移：给旧数据库加 password_hash 列
    try { db.run("ALTER TABLE users ADD COLUMN password_hash TEXT") } catch {}
    try { db.run("ALTER TABLE submissions ADD COLUMN images TEXT DEFAULT '[]'") } catch {}
    // 迁移：加对话和消息表
    try { db.run("CREATE TABLE conversations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT DEFAULT '新对话', created_at TEXT DEFAULT (datetime('now')))") } catch {}
    try { db.run("CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))") } catch {}
    return
  }

  db = new SQL.Database()

  db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author TEXT,
      prompt TEXT NOT NULL,
      platform TEXT NOT NULL,
      category TEXT NOT NULL,
      ai_answer TEXT DEFAULT '',
      share_link TEXT DEFAULT '',
      satisfaction INTEGER DEFAULT 0,
      is_good_case INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE likes (
      case_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (case_id, user_id)
    )
  `)

  db.run(`
    CREATE TABLE comments (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      author TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES submissions(id)
    )
  `)

  db.run(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT '新对话',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
  `)

  saveDb()
}

// ====== 中间件 ======

const app = express()
const UPLOADS_DIR = path.join(__dirname, 'uploads')

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `${genId()}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    cb(null, allowed.includes(file.mimetype))
  },
})

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

function authMiddleware(req, res, next) {
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

function optionalAuth(req, res, next) {
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

// ====== 认证 ======

app.post('/api/auth/register', (req, res) => {
  const { studentId, name, password } = req.body
  if (!studentId || !name || !password) {
    return res.status(400).json({ message: '学号、姓名和密码不能为空' })
  }
  if (password.length < 6) {
    return res.status(400).json({ message: '密码至少6位' })
  }

  const existing = db.exec('SELECT 1 FROM users WHERE student_id = ?', [studentId])
  if (existing[0] && existing[0].values.length) {
    return res.status(400).json({ message: '该学号已注册' })
  }

  const id = genId()
  const hash = bcrypt.hashSync(password, 10)
  db.run('INSERT INTO users (id, student_id, name, password_hash) VALUES (?, ?, ?, ?)', [id, studentId, name, hash])
  saveDb()

  const user = { id, studentId, name, role: 'student' }
  const token = jwt.sign({ id: user.id, studentId: user.studentId, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ code: 0, data: { token, user } })
})

app.post('/api/auth/login', (req, res) => {
  const { studentId, password } = req.body
  if (!studentId || !password) {
    return res.status(400).json({ message: '学号和密码不能为空' })
  }

  const rows = db.exec('SELECT id, student_id, name, role, password_hash FROM users WHERE student_id = ?', [studentId])
  if (!rows[0] || !rows[0].values.length) {
    return res.status(400).json({ message: '学号未注册' })
  }

  const row = rows[0].values[0]
  const hash = row[4]

  // 兼容旧数据（无密码哈希的用户）
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

app.post('/api/auth/logout', (req, res) => {
  res.json({ code: 0, data: null })
})

// ====== 会话管理 ======

app.get('/api/conversations', authMiddleware, (req, res) => {
  const rows = db.exec(
    "SELECT id, title, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC",
    [req.user.id]
  )
  const list = rows[0] ? rows[0].values.map(r => ({ id: r[0], title: r[1], createdAt: r[2] })) : []
  res.json({ code: 0, data: list })
})

app.post('/api/conversations', authMiddleware, (req, res) => {
  const id = genId()
  const title = (req.body.title || '新对话').slice(0, 50)
  db.run("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)", [id, req.user.id, title])
  saveDb()
  res.json({ code: 0, data: { id, title, createdAt: new Date().toISOString() } })
})

app.delete('/api/conversations/:id', authMiddleware, (req, res) => {
  const row = db.exec("SELECT user_id FROM conversations WHERE id = ?", [req.params.id])
  if (!row[0] || !row[0].values.length) {
    return res.status(404).json({ code: 1, message: '会话不存在' })
  }
  if (row[0].values[0][0] !== req.user.id) {
    return res.status(403).json({ code: 1, message: '无权操作' })
  }
  db.run("DELETE FROM messages WHERE conversation_id = ?", [req.params.id])
  db.run("DELETE FROM conversations WHERE id = ?", [req.params.id])
  saveDb()
  res.json({ code: 0, data: null })
})

app.get('/api/conversations/:id/messages', authMiddleware, (req, res) => {
  const conv = db.exec("SELECT user_id FROM conversations WHERE id = ?", [req.params.id])
  if (!conv[0] || !conv[0].values.length) {
    return res.status(404).json({ code: 1, message: '会话不存在' })
  }
  if (conv[0].values[0][0] !== req.user.id) {
    return res.status(403).json({ code: 1, message: '无权操作' })
  }
  const rows = db.exec(
    "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [req.params.id]
  )
  const list = rows[0] ? rows[0].values.map(r => ({ id: r[0], role: r[1], content: r[2], createdAt: r[3] })) : []
  res.json({ code: 0, data: list })
})

// ====== AI 聊天（DeepSeek / Ollama 视觉）======

app.post('/api/chat/send', authMiddleware, async (req, res) => {
  try {
    const { prompt, conversationId, imageUrl } = req.body
    if (!prompt && !imageUrl) return res.status(400).json({ code: 1, message: '请输入内容' })

    // 没有会话则自动创建
    let convId = conversationId
    if (!convId) {
      convId = genId()
      const title = (prompt || '图片对话').slice(0, 30)
      db.run("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)", [convId, req.user.id, title])
    } else {
      // 验证会话归属
      const conv = db.exec("SELECT user_id FROM conversations WHERE id = ?", [convId])
      if (!conv[0] || !conv[0].values.length) {
        return res.status(404).json({ code: 1, message: '会话不存在' })
      }
      if (conv[0].values[0][0] !== req.user.id) {
        return res.status(403).json({ code: 1, message: '无权操作' })
      }
    }

    // 加载历史消息（最近 20 条，避免上下文过长）
    const history = db.exec(
      "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20",
      [convId]
    )
    const historyMessages = history[0]
      ? history[0].values.map(r => ({ role: r[0], content: r[1] })).reverse()
      : []

    const isVision = !!imageUrl
    let reply

    if (isVision) {
      // 视觉模式：构建多模态消息发给 Qwen3-VL
      const dataUrl = readImageAsBase64(imageUrl)

      const visionMessages = [
        { role: 'system', content: '你是一个AI视觉助手。请仔细观察用户提供的图片，结合用户的文字描述，给出准确、详细的回答。使用Markdown格式回复。' },
      ]

      for (const msg of historyMessages) {
        if (msg.role === 'user') {
          const parsed = parseImageContent(msg.content)
          if (parsed.imageUrl) {
            visionMessages.push({
              role: 'user',
              content: [
                { type: 'text', text: parsed.text || '请分析这张图片' },
                { type: 'image_url', image_url: { url: readImageAsBase64(parsed.imageUrl) } },
              ],
            })
          } else {
            visionMessages.push({ role: 'user', content: msg.content })
          }
        } else {
          visionMessages.push({ role: 'assistant', content: msg.content })
        }
      }

      // 当前用户消息
      visionMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt || '请分析这张图片' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      })

      const completion = await ollama.chat.completions.create({
        model: 'qwen3-vl:8b',
        messages: visionMessages,
        temperature: 0.7,
        max_tokens: 2000,
      })

      reply = completion.choices[0]?.message?.content || '（未获取到回复）'
    } else {
      // 纯文本模式：走 DeepSeek
      const messages = [
        { role: 'system', content: '你是一个AI助手。请只回答用户当前最新的问题，不要重复回答对话历史中已经解决过的问题。使用Markdown格式回复，让回答清晰易读。' },
        ...historyMessages.map(m => ({ role: m.role, content: parseImageContent(m.content).text })),
        { role: 'user', content: prompt },
      ]

      const completion = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      })

      reply = completion.choices[0]?.message?.content || '（未获取到回复）'
    }

    // 保存用户消息和 AI 回复
    const userContent = imageUrl ? `[image:${imageUrl}]\n${prompt || ''}` : prompt
    const msg1Id = genId()
    const msg2Id = genId()
    const now = new Date().toISOString()
    db.run("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
      [msg1Id, convId, userContent, now])
    db.run("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)",
      [msg2Id, convId, reply, now])
    saveDb()

    res.json({ code: 0, data: { reply, conversationId: convId } })
  } catch (err) {
    console.error('AI API 错误:', err.message)
    res.status(500).json({ code: 1, message: 'AI 服务暂时不可用，请稍后重试' })
  }
})

// ====== 图片上传 ======

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请选择图片文件' })
  }
  const url = `/uploads/${req.file.filename}`
  res.json({ code: 0, data: { url, name: req.file.originalname } })
})

// ====== 链接解析 ======

app.post('/api/parse-link', authMiddleware, async (req, res) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: '请提供要解析的链接' })
  }

  // SSRF 防护：仅允许 http/https
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return res.status(400).json({ message: '链接格式无效' })
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ message: '仅支持 http/https 链接' })
  }

  // 白名单域名
  const allowedHosts = [
    'chat.deepseek.com',
    'chatgpt.com',
    'claude.ai',
    'kimi.moonshot.cn',
    'tongyi.aliyun.com',
  ]
  const isAllowed = allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))
  if (!isAllowed) {
    return res.status(400).json({ message: '暂不支持该网站的链接解析' })
  }

  try {
    const result = await parseLink(url)
    res.json({ code: 0, data: result })
  } catch (err) {
    console.error('链接解析失败:', err.message)
    res.status(400).json({ message: err.message || '解析失败，请手动填写内容' })
  }
})

// ====== 提交案例 ======

app.post('/api/submissions', authMiddleware, (req, res) => {
  const { prompt, platform, category, aiAnswer, shareLink, satisfaction, isGoodCase, note, tags, images } = req.body
  if (!prompt || !platform || !category) {
    return res.status(400).json({ message: 'Prompt、AI平台和分类为必填项' })
  }

  // 每日限制
  const today = new Date().toISOString().slice(0, 10)
  const todayRow = db.exec(
    "SELECT COUNT(*) FROM submissions WHERE user_id = ? AND created_at >= ?",
    [req.user.id, today]
  )
  const todayCount = todayRow[0].values[0][0]
  if (todayCount >= 5) {
    return res.status(400).json({ message: '今日提交已达上限（5条），请明天再来' })
  }

  // 每周限制
  const weekStart = getWeekRange()
  const weekRow = db.exec(
    "SELECT COUNT(*) FROM submissions WHERE user_id = ? AND created_at >= ?",
    [req.user.id, weekStart]
  )
  const weekCount = weekRow[0].values[0][0]
  if (weekCount >= 20) {
    return res.status(400).json({ message: '本周提交已达上限（20条）' })
  }

  const id = genId()
  const now = new Date().toISOString()
  db.run(
    `INSERT INTO submissions (id, user_id, author, prompt, platform, category, ai_answer, share_link, satisfaction, is_good_case, note, tags, images, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.user.id, req.user.name, prompt, platform, category, aiAnswer || '', shareLink || '', satisfaction || 0, isGoodCase ? 1 : 0, note || '', JSON.stringify(tags || []), JSON.stringify(images || []), now]
  )
  saveDb()

  res.json({
    code: 0,
    data: { id, userId: req.user.id, author: req.user.name, prompt, platform, category, aiAnswer, shareLink, satisfaction, isGoodCase, note, tags, images: images || [], likeCount: 0, commentCount: 0, createdAt: now },
  })
})

// ====== 我的提交 ======

function parseTags(raw) {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

app.get('/api/submissions/my', authMiddleware, (req, res) => {
  const results = db.exec(
    "SELECT id, prompt, platform, category, ai_answer, satisfaction, is_good_case, tags, images, like_count, comment_count, created_at FROM submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [req.user.id]
  )

  const list = results[0] ? results[0].values.map(row => ({
    id: row[0], prompt: row[1], platform: row[2], category: row[3], aiAnswer: row[4], satisfaction: row[5], isGoodCase: !!row[6], tags: parseTags(row[7]), images: parseTags(row[8]), likeCount: row[9], commentCount: row[10], createdAt: row[11],
  })) : []

  // 统计
  const today = new Date().toISOString().slice(0, 10)
  const weekStart = getWeekRange()

  const statsRow = db.exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today_count,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as week_count,
      SUM(CASE WHEN is_good_case = 1 THEN 1 ELSE 0 END) as good_cases,
      ROUND(AVG(satisfaction), 1) as avg_satisfaction
    FROM submissions WHERE user_id = ?
  `, [today, weekStart, req.user.id])

  let stats = { total: 0, todayCount: 0, weekCount: 0, goodCases: 0, avgSatisfaction: 0 }
  if (statsRow[0] && statsRow[0].values.length) {
    const v = statsRow[0].values[0]
    stats = { total: v[0], todayCount: v[1], weekCount: v[2], goodCases: v[3], avgSatisfaction: v[4] || 0 }
  }

  res.json({ code: 0, data: { list, stats } })
})

// ====== 删除提交 ======

app.delete('/api/submissions/:id', authMiddleware, (req, res) => {
  const row = db.exec(
    'SELECT user_id FROM submissions WHERE id = ?',
    [req.params.id]
  )
  if (!row[0] || !row[0].values.length) {
    return res.status(404).json({ message: '该案例不存在' })
  }
  if (row[0].values[0][0] !== req.user.id) {
    return res.status(403).json({ message: '无权删除他人的案例' })
  }

  db.run('DELETE FROM likes WHERE case_id = ?', [req.params.id])
  db.run('DELETE FROM comments WHERE case_id = ?', [req.params.id])
  db.run('DELETE FROM submissions WHERE id = ?', [req.params.id])
  saveDb()

  res.json({ code: 0, data: null })
})

// ====== 案例广场 ======

app.get('/api/cases', optionalAuth, (req, res) => {
  const { category, keyword, sortBy = 'latest', page = 1, pageSize = 12 } = req.query

  let where = "WHERE 1=1"
  const params = []

  if (category) {
    where += " AND category = ?"
    params.push(category)
  }
  if (keyword) {
    where += " AND (prompt LIKE ? OR note LIKE ? OR tags LIKE ?)"
    const kw = `%${keyword}%`
    params.push(kw, kw, kw)
  }

  const countRow = db.exec(`SELECT COUNT(*) FROM submissions ${where}`, params)
  const total = countRow[0] ? countRow[0].values[0][0] : 0

  const order = sortBy === 'hot' ? "like_count DESC" : "created_at DESC"
  const offset = (+page - 1) * +pageSize
  const results = db.exec(
    `SELECT id, author, prompt, platform, category, ai_answer, satisfaction, is_good_case, tags, images, like_count, comment_count, created_at FROM submissions ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, +pageSize, offset]
  )

  const list = results[0] ? results[0].values.map(row => ({
    id: row[0],
    author: row[1],
    prompt: row[2],
    platform: row[3],
    category: row[4],
    aiAnswer: row[5],
    satisfaction: row[6],
    isGoodCase: !!row[7],
    tags: parseTags(row[8]),
    images: parseTags(row[9]),
    likeCount: row[10],
    commentCount: row[11],
    createdAt: row[12],
  })) : []

  // 点赞标记（游客跳过）
  if (req.user?.id && req.user.id !== 'guest') {
    for (const item of list) {
      const likeRow = db.exec("SELECT 1 FROM likes WHERE case_id = ? AND user_id = ?", [item.id, req.user.id])
      item.liked = !!(likeRow[0] && likeRow[0].values.length)
    }
  }

  res.json({ code: 0, data: { list, total } })
})

// ====== 点赞 ======

app.post('/api/cases/:id/like', optionalAuth, (req, res) => {
  const userId = req.user?.id || 'anonymous'

  const existing = db.exec("SELECT 1 FROM likes WHERE case_id = ? AND user_id = ?", [req.params.id, userId])
  const alreadyLiked = !!(existing[0] && existing[0].values.length)

  if (alreadyLiked) {
    db.run("DELETE FROM likes WHERE case_id = ? AND user_id = ?", [req.params.id, userId])
    db.run("UPDATE submissions SET like_count = MAX(0, like_count - 1) WHERE id = ?", [req.params.id])
  } else {
    db.run("INSERT INTO likes (case_id, user_id) VALUES (?, ?)", [req.params.id, userId])
    db.run("UPDATE submissions SET like_count = like_count + 1 WHERE id = ?", [req.params.id])
  }
  saveDb()

  const likeRow = db.exec("SELECT like_count FROM submissions WHERE id = ?", [req.params.id])
  const likeCount = likeRow[0] ? likeRow[0].values[0][0] : 0

  res.json({ code: 0, data: { liked: !alreadyLiked, likeCount } })
})

// ====== 评论 ======

app.get('/api/cases/:id/comments', (req, res) => {
  const results = db.exec(
    "SELECT id, author, content, created_at FROM comments WHERE case_id = ? ORDER BY created_at DESC",
    [req.params.id]
  )
  const comments = results[0] ? results[0].values.map(row => ({
    id: row[0], author: row[1], content: row[2], createdAt: row[3],
  })) : []
  res.json({ code: 0, data: comments })
})

app.post('/api/cases/:id/comments', authMiddleware, (req, res) => {
  const { content } = req.body
  if (!content) return res.status(400).json({ message: '评论内容不能为空' })

  const id = genId()
  db.run("INSERT INTO comments (id, case_id, author, content) VALUES (?, ?, ?, ?)", [id, req.params.id, req.user.name, content])
  db.run("UPDATE submissions SET comment_count = comment_count + 1 WHERE id = ?", [req.params.id])
  saveDb()

  res.json({ code: 0, data: { id, caseId: req.params.id, author: req.user.name, content, createdAt: new Date().toISOString() } })
})

// ====== 启动 ======

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`后端服务已启动: http://localhost:${PORT}`)
    console.log(`SQLite 数据库: ${DB_PATH}`)
    console.log('请先注册账号再登录')
  })
})

process.on('SIGTERM', () => { saveDbNow(); process.exit(0) })
process.on('SIGINT', () => { saveDbNow(); process.exit(0) })
