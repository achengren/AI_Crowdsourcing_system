import { Router } from 'express'
import { z } from 'zod'
import { genId, one, query } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { toBoolean } from '../utils/data.js'
import { extractUserMessage } from '../services/submissionIntegrity.js'

const router = Router()
router.use(authMiddleware)

const diarySchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  occurredAt: z.string().nullable().optional(),
  contextText: z.string().trim().max(20000).optional().default(''),
  needDescription: z.string().trim().max(20000).optional().default(''),
  channels: z.string().trim().max(20000).optional().default(''),
  searchProcess: z.string().trim().max(50000).optional().default(''),
  outcome: z.string().trim().max(50000).optional().default(''),
  reflection: z.string().trim().max(20000).optional().default(''),
  isGenaiRelated: z.boolean().optional().default(false),
  genaiPlatform: z.string().optional().default(''),
  linkedConversationId: z.string().nullable().optional(),
  sourceMessageId: z.string().length(32).nullable().optional(),
  sourceSubmissionId: z.string().length(32).nullable().optional(),
  status: z.enum(['draft', 'submitted']).optional().default('draft'),
})

function mapDiary(row) {
  return {
    ...row,
    isGenaiRelated: toBoolean(row.isGenaiRelated),
    editable: row.editable === undefined ? undefined : toBoolean(row.editable),
    hasLinkedSubmission: row.hasLinkedSubmission === undefined ? undefined : toBoolean(row.hasLinkedSubmission),
  }
}

function diaryCompletionError(data) {
  if (data.status !== 'submitted') return ''
  const required = [data.contextText, data.needDescription, data.channels, data.searchProcess, data.outcome, data.reflection]
  if (required.some(value => !value.trim())) return '请完整填写信息需求及获取过程'
  if (data.isGenaiRelated && !data.genaiPlatform.trim()) return '请选择使用的 GenAI 平台'
  return ''
}

async function messageDraft(userId, messageId) {
  const assistant = await one(
    `SELECT m.id, m.content AS aiAnswer, m.provider AS platform, m.model,
            DATE_FORMAT(m.created_at, '%Y-%m-%d') AS logDate,
            TIME_FORMAT(m.created_at, '%H:%i') AS occurredAt,
            c.id AS conversationId
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ? AND m.role = 'assistant' AND c.user_id = ?`,
    [messageId, userId]
  )
  if (!assistant) return null
  const userMessage = await one(
    `SELECT content FROM messages
     WHERE conversation_id = ? AND role = 'user' AND created_at <= (
       SELECT created_at FROM messages WHERE id = ?
     ) ORDER BY created_at DESC LIMIT 1`,
    [assistant.conversationId, assistant.id]
  )
  const prompt = extractUserMessage(userMessage?.content).prompt
  const platform = assistant.platform || ''
  return {
    logDate: assistant.logDate,
    occurredAt: assistant.occurredAt,
    contextText: '',
    needDescription: prompt,
    channels: platform ? `生成式 AI（${platform}）` : '生成式 AI',
    searchProcess: '',
    outcome: assistant.aiAnswer,
    reflection: '',
    isGenaiRelated: true,
    genaiPlatform: platform,
    linkedConversationId: assistant.conversationId,
    sourceMessageId: assistant.id,
    sourceSubmissionId: null,
    status: 'draft',
    platformLocked: Boolean(platform),
    sourcePreview: { prompt, aiAnswer: assistant.aiAnswer, platform, model: assistant.model },
  }
}

async function resolveSources(userId, data, existing = {}) {
  let sourceMessageId = data.sourceMessageId === undefined ? existing.sourceMessageId || null : data.sourceMessageId
  const sourceSubmissionId = data.sourceSubmissionId === undefined ? existing.sourceSubmissionId || null : data.sourceSubmissionId
  let linkedConversationId = data.linkedConversationId === undefined ? existing.linkedConversationId || null : data.linkedConversationId
  let genaiPlatform = ''

  if (sourceSubmissionId) {
    const submission = await one(
      'SELECT source_message_id AS sourceMessageId, platform FROM submissions WHERE id = ? AND user_id = ?',
      [sourceSubmissionId, userId]
    )
    if (!submission) return null
    genaiPlatform = submission.platform || ''
    if (!sourceMessageId && submission.sourceMessageId) sourceMessageId = submission.sourceMessageId
  }
  if (sourceMessageId) {
    const message = await one(
      `SELECT c.id AS conversationId, m.provider AS platform FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = ? AND m.role = 'assistant' AND c.user_id = ?`,
      [sourceMessageId, userId]
    )
    if (!message) return null
    linkedConversationId = message.conversationId
    genaiPlatform = message.platform || genaiPlatform
  } else if (linkedConversationId) {
    const conversation = await one('SELECT id FROM conversations WHERE id = ? AND user_id = ?', [linkedConversationId, userId])
    if (!conversation) return null
  }
  return { sourceMessageId, sourceSubmissionId, linkedConversationId, genaiPlatform }
}

router.get('/draft/from-message/:messageId', async (req, res) => {
  const draft = await messageDraft(req.user.id, req.params.messageId)
  if (!draft) return res.status(404).json({ message: '找不到该 AI 回复' })
  res.json({ code: 0, data: draft })
})

router.get('/draft/from-case/:caseId', async (req, res) => {
  const item = await one(
    `SELECT s.id, s.prompt, s.ai_answer AS aiAnswer, s.platform, s.model,
            s.source_message_id AS sourceMessageId,
            DATE_FORMAT(s.created_at, '%Y-%m-%d') AS logDate,
            TIME_FORMAT(s.created_at, '%H:%i') AS occurredAt
     FROM submissions s WHERE s.id = ? AND s.user_id = ?`,
    [req.params.caseId, req.user.id]
  )
  if (!item) return res.status(404).json({ message: '案例不存在或不属于当前用户' })
  const fromMessage = item.sourceMessageId ? await messageDraft(req.user.id, item.sourceMessageId) : null
  const data = fromMessage || {
    logDate: item.logDate,
    occurredAt: item.occurredAt,
    contextText: '',
    needDescription: item.prompt,
    channels: item.platform ? `生成式 AI（${item.platform}）` : '生成式 AI',
    searchProcess: '',
    outcome: item.aiAnswer,
    reflection: '',
    isGenaiRelated: true,
    genaiPlatform: item.platform,
    linkedConversationId: null,
    sourceMessageId: null,
    status: 'draft',
    platformLocked: Boolean(item.platform),
    sourcePreview: { prompt: item.prompt, aiAnswer: item.aiAnswer, platform: item.platform, model: item.model },
  }
  res.json({ code: 0, data: { ...data, sourceSubmissionId: item.id } })
})

router.get('/', async (req, res) => {
  const params = [req.user.id]
  let condition = 'WHERE user_id = ?'
  if (req.query.startDate) { condition += ' AND log_date >= ?'; params.push(req.query.startDate) }
  if (req.query.endDate) { condition += ' AND log_date <= ?'; params.push(req.query.endDate) }
  const list = await query(
    `SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') AS logDate,
            TIME_FORMAT(occurred_at, '%H:%i') AS occurredAt,
            context_text AS contextText, need_description AS needDescription,
            channels, search_process AS searchProcess, outcome, reflection,
            is_genai_related AS isGenaiRelated, genai_platform AS genaiPlatform,
            linked_conversation_id AS linkedConversationId,
            source_message_id AS sourceMessageId, source_submission_id AS sourceSubmissionId, status,
            COALESCE(
              (SELECT direct_case.id FROM submissions direct_case
               WHERE direct_case.id = information_need_logs.source_submission_id
                 AND direct_case.user_id = information_need_logs.user_id AND direct_case.status = 'published'),
              (SELECT generated_case.id FROM submissions generated_case
               WHERE generated_case.source_diary_id = information_need_logs.id
                 AND generated_case.user_id = information_need_logs.user_id AND generated_case.status = 'published'
               ORDER BY generated_case.created_at DESC LIMIT 1)
            ) AS linkedSubmissionId,
            (source_submission_id IS NOT NULL OR EXISTS(
              SELECT 1 FROM submissions linked_case
              WHERE linked_case.source_diary_id = information_need_logs.id
                AND linked_case.user_id = information_need_logs.user_id
            )) AS hasLinkedSubmission,
            (log_date = CURRENT_DATE()) AS editable,
            created_at AS createdAt, updated_at AS updatedAt
     FROM information_need_logs ${condition} ORDER BY log_date DESC, occurred_at DESC, created_at DESC`,
    params
  )
  const progress = await query(
    `SELECT DATE_FORMAT(log_date, '%Y-%m-%d') AS logDate,
            COUNT(1) AS total,
            SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted,
            SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts
     FROM information_need_logs WHERE user_id = ? AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
     GROUP BY log_date ORDER BY log_date DESC`,
    [req.user.id]
  )
  res.json({ code: 0, data: { list: list.map(mapDiary), progress } })
})

router.get('/:id', async (req, res) => {
  const item = await one(
    `SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') AS logDate,
            TIME_FORMAT(occurred_at, '%H:%i') AS occurredAt,
            context_text AS contextText, need_description AS needDescription,
            channels, search_process AS searchProcess, outcome, reflection,
            is_genai_related AS isGenaiRelated, genai_platform AS genaiPlatform,
            linked_conversation_id AS linkedConversationId,
            source_message_id AS sourceMessageId, source_submission_id AS sourceSubmissionId, status,
            COALESCE(
              (SELECT direct_case.id FROM submissions direct_case
               WHERE direct_case.id = information_need_logs.source_submission_id
                 AND direct_case.user_id = information_need_logs.user_id AND direct_case.status = 'published'),
              (SELECT generated_case.id FROM submissions generated_case
               WHERE generated_case.source_diary_id = information_need_logs.id
                 AND generated_case.user_id = information_need_logs.user_id AND generated_case.status = 'published'
               ORDER BY generated_case.created_at DESC LIMIT 1)
            ) AS linkedSubmissionId,
            (source_submission_id IS NOT NULL OR EXISTS(
              SELECT 1 FROM submissions linked_case
              WHERE linked_case.source_diary_id = information_need_logs.id
                AND linked_case.user_id = information_need_logs.user_id
            )) AS hasLinkedSubmission,
            (log_date = CURRENT_DATE()) AS editable,
            created_at AS createdAt, updated_at AS updatedAt
     FROM information_need_logs WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id]
  )
  if (!item) return res.status(404).json({ message: '记录不存在' })
  res.json({ code: 0, data: mapDiary(item) })
})

router.post('/', async (req, res) => {
  const parsed = diarySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '信息需求记录格式错误' })
  const data = parsed.data
  const sources = await resolveSources(req.user.id, data)
  if (!sources) return res.status(400).json({ message: '来源对话或案例无效' })
  if (sources.sourceMessageId || sources.sourceSubmissionId) {
    data.isGenaiRelated = true
    if (sources.genaiPlatform) data.genaiPlatform = sources.genaiPlatform
  }
  const completionError = diaryCompletionError(data)
  if (completionError) return res.status(400).json({ message: completionError })
  const id = genId()
  await query(
    `INSERT INTO information_need_logs
     (id, user_id, log_date, occurred_at, context_text, need_description, channels,
      search_process, outcome, reflection, is_genai_related, genai_platform,
      linked_conversation_id, source_message_id, source_submission_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.user.id, data.logDate, data.occurredAt || null, data.contextText,
      data.needDescription, data.channels, data.searchProcess, data.outcome, data.reflection,
      data.isGenaiRelated ? 1 : 0, data.isGenaiRelated ? data.genaiPlatform : '',
      sources.linkedConversationId, sources.sourceMessageId, sources.sourceSubmissionId, data.status]
  )
  res.json({ code: 0, data: { id } })
})

router.put('/:id', async (req, res) => {
  const parsed = diarySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '信息需求记录格式错误' })
  const existing = await one(
    `SELECT id, linked_conversation_id AS linkedConversationId, source_message_id AS sourceMessageId,
            source_submission_id AS sourceSubmissionId,
            DATE_FORMAT(log_date, '%Y-%m-%d') AS logDate,
            (log_date = CURRENT_DATE()) AS editable
     FROM information_need_logs WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id]
  )
  if (!existing) return res.status(404).json({ message: '记录不存在' })
  if (!toBoolean(existing.editable)) return res.status(403).json({ message: '历史信息需求记录仅供查看，只能修改当天记录' })
  const data = parsed.data
  data.logDate = existing.logDate
  const sources = await resolveSources(req.user.id, data, existing)
  if (!sources) return res.status(400).json({ message: '来源对话或案例无效' })
  if (sources.sourceMessageId || sources.sourceSubmissionId) {
    data.isGenaiRelated = true
    if (sources.genaiPlatform) data.genaiPlatform = sources.genaiPlatform
  }
  const completionError = diaryCompletionError(data)
  if (completionError) return res.status(400).json({ message: completionError })
  await query(
    `UPDATE information_need_logs SET log_date = ?, occurred_at = ?, context_text = ?,
     need_description = ?, channels = ?, search_process = ?, outcome = ?, reflection = ?,
     is_genai_related = ?, genai_platform = ?, linked_conversation_id = ?,
     source_message_id = ?, source_submission_id = ?, status = ? WHERE id = ?`,
    [data.logDate, data.occurredAt || null, data.contextText, data.needDescription,
      data.channels, data.searchProcess, data.outcome, data.reflection,
      data.isGenaiRelated ? 1 : 0, data.isGenaiRelated ? data.genaiPlatform : '',
      sources.linkedConversationId, sources.sourceMessageId, sources.sourceSubmissionId, data.status, req.params.id]
  )
  res.json({ code: 0, data: null })
})

router.delete('/:id', async (req, res) => {
  const existing = await one(
    'SELECT (log_date = CURRENT_DATE()) AS editable FROM information_need_logs WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  )
  if (!existing) return res.status(404).json({ message: '记录不存在' })
  if (!toBoolean(existing.editable)) return res.status(403).json({ message: '历史信息需求记录不能删除' })
  const result = await query(
    'DELETE FROM information_need_logs WHERE id = ? AND user_id = ? AND log_date = CURRENT_DATE()',
    [req.params.id, req.user.id]
  )
  if (!result.affectedRows) return res.status(409).json({ message: '记录状态已变化，请刷新后重试' })
  res.json({ code: 0, data: null })
})

export default router
