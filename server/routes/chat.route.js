import { Router } from 'express'
import { genId, one, query, transaction } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { sendVisionMessage, sendTextMessage, generateTitle, generateSolutionSuggestion, summarizeConversation } from '../services/chatService.js'
import { acquireAiSlot, releaseAiSlot } from '../services/aiLimiter.js'
import { AI_CONTEXT_TOKEN_BUDGET } from '../config.js'
import { contextWithSummary, estimateTokens, selectContextWindow } from '../services/contextWindow.js'

const router = Router()

router.post('/send', authMiddleware, async (req, res) => {
  const { prompt, conversationId, imageUrl } = req.body
  if (!prompt && !imageUrl) return res.status(400).json({ message: '请输入内容' })
  if (imageUrl) {
    const owned = await one(
      'SELECT 1 FROM uploaded_files WHERE file_path = ? AND user_id = ? LIMIT 1',
      [imageUrl, req.user.id]
    )
    if (!owned) return res.status(400).json({ message: '无效的图片引用' })
  }
  if (!acquireAiSlot(req.user.id)) return res.status(429).json({ message: 'AI 请求较多，请等待当前请求完成后再试' })

  try {
    let conversation = null
    if (conversationId) {
      conversation = await one(
        `SELECT id, user_id AS userId, context_summary AS contextSummary,
                summarized_message_count AS summarizedMessageCount
         FROM conversations WHERE id = ?`,
        [conversationId]
      )
      if (!conversation) return res.status(404).json({ message: '会话不存在' })
      if (conversation.userId !== req.user.id) return res.status(403).json({ message: '无权操作' })
    }

    let historyMessages = conversationId
      ? await query(
          `SELECT role, content, vision_context AS visionContext
           FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, FIELD(role, 'user', 'assistant')`,
          [conversationId]
        )
      : []

    let contextSummary = conversation?.contextSummary || ''
    if (conversation) {
      const summarizedCount = Number(conversation.summarizedMessageCount || 0)
      const unsummarized = historyMessages.slice(summarizedCount)
      const reservedTokens = 2500 + estimateTokens(prompt) + estimateTokens(contextSummary)
      let selected = selectContextWindow(unsummarized, AI_CONTEXT_TOKEN_BUDGET, reservedTokens)
      if (selected.messagesToSummarize.length) {
        try {
          const newSummary = await summarizeConversation(contextSummary, selected.messagesToSummarize)
          if (newSummary) {
            const nextCount = summarizedCount + selected.messagesToSummarize.length
            const updated = await query(
              `UPDATE conversations SET context_summary = ?, summarized_message_count = ?
               WHERE id = ? AND summarized_message_count = ?`,
              [newSummary, nextCount, conversationId, summarizedCount]
            )
            if (updated.affectedRows) contextSummary = newSummary
            else {
              const latest = await one(
                `SELECT context_summary AS contextSummary, summarized_message_count AS summarizedMessageCount
                 FROM conversations WHERE id = ?`,
                [conversationId]
              )
              contextSummary = latest?.contextSummary || contextSummary
              const latestCount = Number(latest?.summarizedMessageCount || summarizedCount)
              selected = selectContextWindow(
                historyMessages.slice(latestCount),
                AI_CONTEXT_TOKEN_BUDGET,
                2500 + estimateTokens(prompt) + estimateTokens(contextSummary)
              )
            }
          }
        } catch (error) {
          console.warn('对话摘要更新失败，使用近期上下文继续回答:', error.message)
        }
      }
      historyMessages = contextWithSummary(contextSummary, selected.recentMessages)
    }

    const result = imageUrl
      ? await sendVisionMessage(historyMessages, prompt, imageUrl)
      : await sendTextMessage(historyMessages, prompt)

    const convId = conversationId || genId()
    const userMessageId = genId()
    const assistantMessageId = genId()
    const conversationTitle = conversationId ? '' : await generateTitle(prompt, result.content)
    const userContent = imageUrl ? `[image:${imageUrl}]\n${prompt || ''}` : prompt
    const userCreatedAt = new Date()
    const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1)

    await transaction(async connection => {
      if (!conversationId) {
        await connection.execute(
          'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
          [convId, req.user.id, conversationTitle]
        )
      }
      await connection.execute(
        `INSERT INTO messages (id, conversation_id, role, content, vision_context, modality, created_at)
         VALUES (?, ?, 'user', ?, ?, ?, ?)`,
        [userMessageId, convId, userContent, result.visionContext || null, imageUrl ? 'vision' : 'text', userCreatedAt]
      )
      await connection.execute(
        `INSERT INTO messages (id, conversation_id, role, content, provider, model, modality, thinking_enabled, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?)`,
        [assistantMessageId, convId, result.content, result.provider, result.model, result.modality, result.thinkingEnabled ? 1 : 0, assistantCreatedAt]
      )
      await connection.execute('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [convId])
    })

    res.json({
      code: 0,
      data: {
        reply: result.content,
        conversationId: convId,
        messageId: assistantMessageId,
        provider: result.provider,
        model: result.model,
        modality: result.modality,
        thinkingEnabled: result.thinkingEnabled,
        conversationTitle: conversationTitle || undefined,
      },
    })
  } catch (error) {
    console.error('AI API 错误:', error.message)
    const stage = error.stage === 'vision' ? 'vision' : 'answer'
    res.status(500).json({
      message: stage === 'vision' ? '图片识别失败，请重试' : '回答生成失败，请重试',
      stage,
    })
  } finally {
    releaseAiSlot(req.user.id)
  }
})

router.post('/solution-suggestion', authMiddleware, async (req, res) => {
  const { prompt, reply } = req.body
  if (!prompt || !reply) return res.status(400).json({ message: '缺少参数' })
  if (!acquireAiSlot(req.user.id)) return res.status(429).json({ message: 'AI 请求较多，请等待当前请求完成后再试' })
  try {
    const suggestion = await generateSolutionSuggestion(prompt, reply)
    res.json({ code: 0, data: { suggestion } })
  } finally {
    releaseAiSlot(req.user.id)
  }
})

export default router
