import { Router } from 'express'
import { getDb, genId, saveDb } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { sendVisionMessage, sendTextMessage, generateTitle } from '../services/chatService.js'

const router = Router()

router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { prompt, conversationId, imageUrl } = req.body
    if (!prompt && !imageUrl) return res.status(400).json({ code: 1, message: '请输入内容' })

    let convId = conversationId
    if (!convId) {
      convId = genId()
      const title = (prompt || '图片对话').slice(0, 30)
      getDb().run("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)", [convId, req.user.id, title])
    } else {
      const conv = getDb().exec("SELECT user_id FROM conversations WHERE id = ?", [convId])
      if (!conv[0] || !conv[0].values.length) {
        return res.status(404).json({ code: 1, message: '会话不存在' })
      }
      if (conv[0].values[0][0] !== req.user.id) {
        return res.status(403).json({ code: 1, message: '无权操作' })
      }
    }

    const history = getDb().exec(
      "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20",
      [convId]
    )
    const historyMessages = history[0]
      ? history[0].values.map(r => ({ role: r[0], content: r[1] })).reverse()
      : []

    const reply = imageUrl
      ? await sendVisionMessage(historyMessages, prompt, imageUrl)
      : await sendTextMessage(historyMessages, prompt)

    const userContent = imageUrl ? `[image:${imageUrl}]\n${prompt || ''}` : prompt
    const msg1Id = genId()
    const msg2Id = genId()
    const now = new Date().toISOString()
    getDb().run("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
      [msg1Id, convId, userContent, now])
    getDb().run("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)",
      [msg2Id, convId, reply, now])
    saveDb()

    if (!conversationId) {
      try {
        const autoTitle = await generateTitle(prompt)
        if (autoTitle) {
          getDb().run("UPDATE conversations SET title = ? WHERE id = ?", [autoTitle, convId])
          saveDb()
        }
      } catch (e) {
        console.error('标题生成失败:', e.message)
      }
    }

    res.json({ code: 0, data: { reply, conversationId: convId } })
  } catch (err) {
    console.error('AI API 错误:', err.message)
    res.status(500).json({ code: 1, message: 'AI 服务暂时不可用，请稍后重试' })
  }
})

export default router
