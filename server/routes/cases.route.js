import { Router } from 'express'
import { getDb, genId, saveDb } from '../db.js'
import { authMiddleware, optionalAuth } from '../middleware.js'
import { parseTags } from '../utils/image.js'

const router = Router()

// 案例广场列表
router.get('/', optionalAuth, (req, res) => {
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

  const countRow = getDb().exec(`SELECT COUNT(*) FROM submissions ${where}`, params)
  const total = countRow[0] ? countRow[0].values[0][0] : 0

  const order = sortBy === 'hot' ? "like_count DESC" : "created_at DESC"
  const offset = (+page - 1) * +pageSize
  const results = getDb().exec(
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

  if (req.user?.id && req.user.id !== 'guest') {
    for (const item of list) {
      const likeRow = getDb().exec("SELECT 1 FROM likes WHERE case_id = ? AND user_id = ?", [item.id, req.user.id])
      item.liked = !!(likeRow[0] && likeRow[0].values.length)
    }
  }

  res.json({ code: 0, data: { list, total } })
})

// 点赞/取消
router.post('/:id/like', optionalAuth, (req, res) => {
  const userId = req.user?.id || 'anonymous'

  const existing = getDb().exec("SELECT 1 FROM likes WHERE case_id = ? AND user_id = ?", [req.params.id, userId])
  const alreadyLiked = !!(existing[0] && existing[0].values.length)

  if (alreadyLiked) {
    getDb().run("DELETE FROM likes WHERE case_id = ? AND user_id = ?", [req.params.id, userId])
    getDb().run("UPDATE submissions SET like_count = MAX(0, like_count - 1) WHERE id = ?", [req.params.id])
  } else {
    getDb().run("INSERT INTO likes (case_id, user_id) VALUES (?, ?)", [req.params.id, userId])
    getDb().run("UPDATE submissions SET like_count = like_count + 1 WHERE id = ?", [req.params.id])
  }
  saveDb()

  const likeRow = getDb().exec("SELECT like_count FROM submissions WHERE id = ?", [req.params.id])
  const likeCount = likeRow[0] ? likeRow[0].values[0][0] : 0

  res.json({ code: 0, data: { liked: !alreadyLiked, likeCount } })
})

// 评论列表
router.get('/:id/comments', (req, res) => {
  const results = getDb().exec(
    "SELECT id, author, content, created_at FROM comments WHERE case_id = ? ORDER BY created_at DESC",
    [req.params.id]
  )
  const comments = results[0] ? results[0].values.map(row => ({
    id: row[0], author: row[1], content: row[2], createdAt: row[3],
  })) : []
  res.json({ code: 0, data: comments })
})

// 发表评论
router.post('/:id/comments', authMiddleware, (req, res) => {
  const { content } = req.body
  if (!content) return res.status(400).json({ message: '评论内容不能为空' })

  const id = genId()
  getDb().run("INSERT INTO comments (id, case_id, author, content) VALUES (?, ?, ?, ?)", [id, req.params.id, req.user.name, content])
  getDb().run("UPDATE submissions SET comment_count = comment_count + 1 WHERE id = ?", [req.params.id])
  saveDb()

  res.json({ code: 0, data: { id, caseId: req.params.id, author: req.user.name, content, createdAt: new Date().toISOString() } })
})

export default router
