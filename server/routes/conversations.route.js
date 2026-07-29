import { Router } from 'express'
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

router.get('/:id/messages', authMiddleware, async (req, res) => {
  const conversation = await one('SELECT user_id AS userId FROM conversations WHERE id = ?', [req.params.id])
  if (!conversation) return res.status(404).json({ message: '会话不存在' })
  if (conversation.userId !== req.user.id) return res.status(403).json({ message: '无权操作' })

  const list = await query(
    `SELECT id, role, content, quality_flag AS qualityFlag, provider, model, modality,
            thinking_enabled AS thinkingEnabled, created_at AS createdAt
     FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    [req.params.id]
  )
  res.json({ code: 0, data: list.map(item => ({ ...item, thinkingEnabled: Boolean(item.thinkingEnabled) })) })
})

export default router
