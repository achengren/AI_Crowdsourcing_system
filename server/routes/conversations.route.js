import { Router } from 'express'
import { z } from 'zod'
import { genId, one, query } from '../db.js'
import { authMiddleware } from '../middleware.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const list = await query(
    'SELECT id, title, created_at AS createdAt, updated_at AS updatedAt FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
    [req.user.id]
  )
  res.json({ code: 0, data: list })
})

router.post('/', authMiddleware, async (req, res) => {
  const id = genId()
  const title = String(req.body.title || '新对话').slice(0, 50)
  await query('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)', [id, req.user.id, title])
  res.json({ code: 0, data: { id, title, createdAt: new Date().toISOString() } })
})

router.patch('/:id/title', authMiddleware, async (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(1).max(50) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '标题长度应为 1-50 个字符' })
  const result = await query(
    'UPDATE conversations SET title = ?, title_manually_edited = 1 WHERE id = ? AND user_id = ?',
    [parsed.data.title, req.params.id, req.user.id]
  )
  if (!result.affectedRows) return res.status(404).json({ message: '会话不存在或无权操作' })
  res.json({ code: 0, data: { id: req.params.id, title: parsed.data.title } })
})

router.put('/:id/messages/:messageId/rating', authMiddleware, async (req, res) => {
  const parsed = z.object({ score: z.number().int().min(1).max(5) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '评分必须为 1-5 星' })
  const target = await one(
    `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ? AND m.conversation_id = ? AND m.role = 'assistant' AND c.user_id = ?`,
    [req.params.messageId, req.params.id, req.user.id]
  )
  if (!target) return res.status(404).json({ message: 'AI 回复不存在或无权操作' })
  await query(
    `INSERT INTO message_ratings (message_id, user_id, score) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score), user_id = VALUES(user_id)`,
    [target.id, req.user.id, parsed.data.score]
  )
  res.json({ code: 0, data: { messageId: target.id, score: parsed.data.score } })
})

router.get('/:id/messages', authMiddleware, async (req, res) => {
  const conversation = await one('SELECT user_id AS userId FROM conversations WHERE id = ?', [req.params.id])
  if (!conversation) return res.status(404).json({ message: '会话不存在' })
  if (conversation.userId !== req.user.id) return res.status(403).json({ message: '无权操作' })

  const list = await query(
    `SELECT m.id, m.role, m.content, m.quality_flag AS qualityFlag, m.provider, m.model, m.modality,
            m.thinking_enabled AS thinkingEnabled, m.created_at AS createdAt,
            COALESCE(r.score, 0) AS rating
     FROM messages m LEFT JOIN message_ratings r ON r.message_id = m.id
     WHERE m.conversation_id = ? ORDER BY m.created_at ASC`,
    [req.params.id]
  )
  res.json({ code: 0, data: list.map(item => ({ ...item, thinkingEnabled: Boolean(item.thinkingEnabled) })) })
})

export default router
