import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { getDb, genId, saveDb } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { UPLOADS_DIR } from '../config.js'

const router = Router()

router.get('/', authMiddleware, (req, res) => {
  const rows = getDb().exec(
    "SELECT id, title, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC",
    [req.user.id]
  )
  const list = rows[0] ? rows[0].values.map(r => ({ id: r[0], title: r[1], createdAt: r[2] })) : []
  res.json({ code: 0, data: list })
})

router.post('/', authMiddleware, (req, res) => {
  const id = genId()
  const title = (req.body.title || '新对话').slice(0, 50)
  getDb().run("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)", [id, req.user.id, title])
  saveDb()
  res.json({ code: 0, data: { id, title, createdAt: new Date().toISOString() } })
})

router.delete('/:id', authMiddleware, (req, res) => {
  const row = getDb().exec("SELECT user_id FROM conversations WHERE id = ?", [req.params.id])
  if (!row[0] || !row[0].values.length) {
    return res.status(404).json({ code: 1, message: '会话不存在' })
  }
  if (row[0].values[0][0] !== req.user.id) {
    return res.status(403).json({ code: 1, message: '无权操作' })
  }

  // 删除该会话中所有已上传的图片文件
  const msgs = getDb().exec(
    "SELECT content FROM messages WHERE conversation_id = ? AND role = 'user'",
    [req.params.id]
  )
  if (msgs[0]) {
    for (const [content] of msgs[0].values) {
      const m = content.match(/^\[image:(.+?)\]\n/)
      if (m) {
        const filePath = path.join(UPLOADS_DIR, path.basename(m[1]))
        try { fs.unlinkSync(filePath) } catch {}
      }
    }
  }

  getDb().run("DELETE FROM messages WHERE conversation_id = ?", [req.params.id])
  getDb().run("DELETE FROM conversations WHERE id = ?", [req.params.id])
  saveDb()
  res.json({ code: 0, data: null })
})

router.get('/:id/messages', authMiddleware, (req, res) => {
  const conv = getDb().exec("SELECT user_id FROM conversations WHERE id = ?", [req.params.id])
  if (!conv[0] || !conv[0].values.length) {
    return res.status(404).json({ code: 1, message: '会话不存在' })
  }
  if (conv[0].values[0][0] !== req.user.id) {
    return res.status(403).json({ code: 1, message: '无权操作' })
  }
  const rows = getDb().exec(
    "SELECT id, role, content, quality_flag, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [req.params.id]
  )
  const list = rows[0] ? rows[0].values.map(r => {
    let qualityFlag = null
    try { qualityFlag = JSON.parse(r[3] || 'null') } catch {}
    return { id: r[0], role: r[1], content: r[2], qualityFlag, createdAt: r[4] }
  }) : []
  res.json({ code: 0, data: list })
})

export default router
