import { Router } from 'express'
import { getDb, genId, saveDb } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { parseTags } from '../utils/image.js'
import { checkDailyLimit, checkWeeklyLimit, calculateStats } from '../services/submissionService.js'

const router = Router()

router.post('/', authMiddleware, (req, res) => {
  const { prompt, platform, category, aiAnswer, shareLink, satisfaction, isGoodCase, note, tags, images } = req.body
  if (!prompt || !platform || !category) {
    return res.status(400).json({ message: 'Prompt、AI平台和分类为必填项' })
  }

  const daily = checkDailyLimit(req.user.id)
  if (daily.exceeded) {
    return res.status(400).json({ message: '今日提交已达上限（5条），请明天再来' })
  }
  const weekly = checkWeeklyLimit(req.user.id)
  if (weekly.exceeded) {
    return res.status(400).json({ message: '本周提交已达上限（20条）' })
  }

  const id = genId()
  const now = new Date().toISOString()
  getDb().run(
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

router.get('/my', authMiddleware, (req, res) => {
  const results = getDb().exec(
    "SELECT id, prompt, platform, category, ai_answer, satisfaction, is_good_case, tags, images, like_count, comment_count, created_at FROM submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [req.user.id]
  )

  const list = results[0] ? results[0].values.map(row => ({
    id: row[0], prompt: row[1], platform: row[2], category: row[3], aiAnswer: row[4], satisfaction: row[5], isGoodCase: !!row[6], tags: parseTags(row[7]), images: parseTags(row[8]), likeCount: row[9], commentCount: row[10], createdAt: row[11],
  })) : []

  const stats = calculateStats(req.user.id)

  res.json({ code: 0, data: { list, stats } })
})

router.delete('/:id', authMiddleware, (req, res) => {
  const row = getDb().exec(
    'SELECT user_id FROM submissions WHERE id = ?',
    [req.params.id]
  )
  if (!row[0] || !row[0].values.length) {
    return res.status(404).json({ message: '该案例不存在' })
  }
  if (row[0].values[0][0] !== req.user.id) {
    return res.status(403).json({ message: '无权删除他人的案例' })
  }

  getDb().run('DELETE FROM likes WHERE case_id = ?', [req.params.id])
  getDb().run('DELETE FROM comments WHERE case_id = ?', [req.params.id])
  getDb().run('DELETE FROM submissions WHERE id = ?', [req.params.id])
  saveDb()

  res.json({ code: 0, data: null })
})

export default router
