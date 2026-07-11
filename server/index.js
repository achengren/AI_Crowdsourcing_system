import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const genId = () => crypto.randomBytes(16).toString('hex')

const app = express()
app.use(cors())
app.use(express.json())

const JWT_SECRET = 'ai-crowdsourcing-secret-key-2024'
const DB_PATH = path.join(__dirname, 'db.json')
const PORT = 3001

function loadDb() {
  if (!fs.existsSync(DB_PATH)) return { users: [], submissions: [], comments: [], likes: {} }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

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

app.post('/api/auth/login', (req, res) => {
  const { studentId, password } = req.body
  if (!studentId || !password) {
    return res.status(400).json({ message: '学号和密码不能为空' })
  }

  const db = loadDb()
  let user = db.users.find((u) => u.studentId === studentId)

  if (!user) {
    user = { id: genId(), studentId, name: `同学${studentId.slice(-3)}`, role: 'student', createdAt: new Date().toISOString() }
    db.users.push(user)
    saveDb(db)
  }

  const token = jwt.sign({ id: user.id, studentId: user.studentId, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ code: 0, data: { token, user } })
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

  const db = loadDb()

  // 每日限制检查
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = db.submissions.filter(
    (s) => s.userId === req.user.id && s.createdAt.slice(0, 10) === today
  ).length
  if (todayCount >= 5) {
    return res.status(400).json({ message: '今日提交已达上限（5条），请明天再来' })
  }

  // 每周限制检查
  const { monday, sunday } = getWeekRange()
  const weekCount = db.submissions.filter((s) => {
    if (s.userId !== req.user.id) return false
    const d = new Date(s.createdAt)
    return d >= monday && d <= sunday
  }).length
  if (weekCount >= 20) {
    return res.status(400).json({ message: '本周提交已达上限（20条）' })
  }

  const submission = {
    id: genId(),
    userId: req.user.id,
    author: req.user.name,
    prompt,
    platform,
    category,
    aiAnswer: aiAnswer || '',
    shareLink: shareLink || '',
    satisfaction: satisfaction || 0,
    isGoodCase: isGoodCase || false,
    note: note || '',
    tags: tags || [],
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date().toISOString(),
  }

  db.submissions.unshift(submission)
  saveDb(db)

  res.json({ code: 0, data: submission })
})

// ====== 我的提交 ======

app.get('/api/submissions/my', authMiddleware, (req, res) => {
  const db = loadDb()
  const mySubs = db.submissions
    .filter((s) => s.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // 统计
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = mySubs.filter((s) => s.createdAt.slice(0, 10) === today).length

  const { monday } = getWeekRange()
  const weekCount = mySubs.filter((s) => new Date(s.createdAt) >= monday).length

  const goodCases = mySubs.filter((s) => s.isGoodCase).length
  const avgSatisfaction = mySubs.length
    ? Math.round((mySubs.reduce((sum, s) => sum + s.satisfaction, 0) / mySubs.length) * 10) / 10
    : 0

  res.json({
    code: 0,
    data: {
      list: mySubs.slice(0, 50),
      stats: { total: mySubs.length, weekCount, todayCount, goodCases, avgSatisfaction },
    },
  })
})

// ====== 案例广场 ======

app.get('/api/cases', (req, res) => {
  const { category, keyword, sortBy = 'latest', page = 1, pageSize = 12 } = req.query
  const db = loadDb()

  let cases = db.submissions.filter((s) => s.isGoodCase || true) // 所有案例可见

  if (category) {
    cases = cases.filter((s) => s.category === category)
  }
  if (keyword) {
    cases = cases.filter(
      (s) => s.prompt.includes(keyword) || s.note?.includes(keyword) || s.tags?.some((t) => t.includes(keyword))
    )
  }

  if (sortBy === 'hot') {
    cases.sort((a, b) => b.likeCount - a.likeCount)
  } else {
    cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  const total = cases.length
  const p = +page
  const ps = +pageSize
  const list = cases.slice((p - 1) * ps, p * ps).map((s) => ({
    ...s,
    liked: (db.likes[s.id] || []).includes(req.user?.id),
  }))

  res.json({ code: 0, data: { list, total } })
})

// ====== 点赞 ======

app.post('/api/cases/:id/like', (req, res) => {
  const db = loadDb()
  const userId = req.body.userId || 'anonymous'
  const submission = db.submissions.find((s) => s.id === req.params.id)

  if (!submission) {
    return res.status(404).json({ message: '案例不存在' })
  }

  if (!db.likes[submission.id]) db.likes[submission.id] = []
  const idx = db.likes[submission.id].indexOf(userId)
  if (idx > -1) {
    db.likes[submission.id].splice(idx, 1)
    submission.likeCount = Math.max(0, submission.likeCount - 1)
  } else {
    db.likes[submission.id].push(userId)
    submission.likeCount++
  }

  saveDb(db)
  res.json({ code: 0, data: { liked: idx === -1, likeCount: submission.likeCount } })
})

// ====== 评论 ======

app.get('/api/cases/:id/comments', (req, res) => {
  const db = loadDb()
  const comments = (db.comments || []).filter((c) => c.caseId === req.params.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  res.json({ code: 0, data: comments })
})

app.post('/api/cases/:id/comments', authMiddleware, (req, res) => {
  const { content } = req.body
  if (!content) return res.status(400).json({ message: '评论内容不能为空' })

  const db = loadDb()
  if (!db.comments) db.comments = []

  const comment = {
    id: genId(),
    caseId: req.params.id,
    author: req.user.name,
    content,
    createdAt: new Date().toISOString(),
  }

  db.comments.push(comment)
  const submission = db.submissions.find((s) => s.id === req.params.id)
  if (submission) submission.commentCount = (submission.commentCount || 0) + 1

  saveDb(db)
  res.json({ code: 0, data: comment })
})

// ====== 启动 ======

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`)
  console.log(`可用账号: 任意学号 + 任意密码即可注册/登录`)
})
