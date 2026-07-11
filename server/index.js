import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JWT_SECRET = 'ai-crowdsourcing-secret-key-2024'
const DB_PATH = path.join(__dirname, 'data.db')
const PORT = 3001

const genId = () => crypto.randomBytes(16).toString('hex')

let db

function saveDb() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
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

  saveDb()
}

// ====== 中间件 ======

const app = express()
app.use(cors())
app.use(express.json())

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
  if (!hash || bcrypt.compareSync(password, hash)) {
    const user = { id: row[0], studentId: row[1], name: row[2], role: row[3] }
    const token = jwt.sign({ id: user.id, studentId: user.studentId, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ code: 0, data: { token, user } })
  }

  res.status(400).json({ message: '密码错误' })
})

app.post('/api/auth/logout', (req, res) => {
  res.json({ code: 0, data: null })
})

// ====== AI 聊天（Mock）======

app.post('/api/chat/send', authMiddleware, (req, res) => {
  const { prompt } = req.body
  const replies = [
    `关于"${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}"这个问题，我的理解是：这是一个非常有趣的话题。不过由于我的训练数据截止日期限制，我可能无法提供最实时的信息。建议你查阅最新的相关资料。`,
    `这是一个好问题！根据现有的知识，我可以提供一些思路，但具体到你的需求，我可能无法给出最精准的答案。你可以尝试提供更多上下文，或者访问相关的专业数据库获取更详细的信息。`,
    `抱歉，我无法直接访问外部网站和数据库来验证这个信息。我建议你通过官方渠道查询最新数据，或者提供更多细节让我尝试从已有知识中为你分析。`,
    `你的问题涉及到实时数据和特定平台的内容，我目前无法直接获取。如果你能提供更多背景信息，我可以帮你梳理分析框架和思考方向。`,
  ]
  const reply = replies[Math.floor(Math.random() * replies.length)]
  setTimeout(() => {
    res.json({ code: 0, data: { reply } })
  }, 600 + Math.random() * 800)
})

// ====== 提交案例 ======

app.post('/api/submissions', authMiddleware, (req, res) => {
  const { prompt, platform, category, aiAnswer, shareLink, satisfaction, isGoodCase, note, tags } = req.body
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
    `INSERT INTO submissions (id, user_id, author, prompt, platform, category, ai_answer, share_link, satisfaction, is_good_case, note, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.user.id, req.user.name, prompt, platform, category, aiAnswer || '', shareLink || '', satisfaction || 0, isGoodCase ? 1 : 0, note || '', JSON.stringify(tags || []), now]
  )
  saveDb()

  res.json({
    code: 0,
    data: { id, userId: req.user.id, author: req.user.name, prompt, platform, category, aiAnswer, shareLink, satisfaction, isGoodCase, note, tags, likeCount: 0, commentCount: 0, createdAt: now },
  })
})

// ====== 我的提交 ======

app.get('/api/submissions/my', authMiddleware, (req, res) => {
  const results = db.exec(
    "SELECT id, prompt, platform, category, ai_answer, satisfaction, is_good_case, tags, like_count, comment_count, created_at FROM submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [req.user.id]
  )
  const list = results[0] ? results[0].values.map(row => ({
    id: row[0], prompt: row[1], platform: row[2], category: row[3], aiAnswer: row[4], satisfaction: row[5], isGoodCase: !!row[6], tags: JSON.parse(row[7]), likeCount: row[8], commentCount: row[9], createdAt: row[10],
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

// ====== 案例广场 ======

app.get('/api/cases', (req, res) => {
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
    `SELECT id, author, prompt, platform, category, ai_answer, satisfaction, is_good_case, tags, like_count, comment_count, created_at FROM submissions ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
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
    tags: JSON.parse(row[8] || '[]'),
    likeCount: row[9],
    commentCount: row[10],
    createdAt: row[11],
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

app.post('/api/cases/:id/like', (req, res) => {
  const userId = req.body.userId || 'anonymous'

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
