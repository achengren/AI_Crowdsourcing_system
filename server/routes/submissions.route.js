import { Router } from 'express'
import { z } from 'zod'
import { genId, one, query, transaction } from '../db.js'
import { authMiddleware, upload } from '../middleware.js'
import { acquireAiSlot, releaseAiSlot } from '../services/aiLimiter.js'
import { importConversationScreenshots, importConversationText } from '../services/conversationImportService.js'
import { storeUpload } from '../services/storage.js'
import { checkDailyLimit, checkWeeklyLimit, calculateStats } from '../services/submissionService.js'
import { annotationIntegrityError, extractUserMessage, lockSubmissionToMessage } from '../services/submissionIntegrity.js'
import { parseJson, toBoolean } from '../utils/data.js'
import { canDeleteSubmissionVersion } from '../services/teachingPolicy.js'
import { ERROR_TYPES, KNOWLEDGE_SCENARIOS, SOURCE_ISSUES, caseTaxonomyError, normalizeCaseTaxonomy } from '../services/caseTaxonomy.js'

const router = Router()
const annotationSchema = z.object({
  selectedText: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  prefixText: z.string().optional().default(''),
  suffixText: z.string().optional().default(''),
  issueType: z.enum(ERROR_TYPES),
  comment: z.string().min(1),
  source: z.enum(['user', 'ai']).optional().default('user'),
  confidence: z.number().min(0).max(1).nullable().optional(),
})

const submissionSchema = z.object({
  prompt: z.string().optional().default(''),
  platform: z.string().optional().default(''),
  platformOther: z.string().trim().max(100).optional().default(''),
  model: z.string().optional().default(''),
  category: z.string().optional().default(''),
  errorType: z.enum(ERROR_TYPES).optional().default('other'),
  errorTypes: z.array(z.enum(ERROR_TYPES)).max(ERROR_TYPES.length).optional(),
  errorTypeOther: z.string().trim().max(200).optional().default(''),
  knowledgeScenarios: z.array(z.enum(KNOWLEDGE_SCENARIOS)).max(6).optional().default([]),
  knowledgeScenarioOther: z.string().trim().max(200).optional().default(''),
  sourceIssue: z.enum(SOURCE_ISSUES).optional().default('none'),
  sourceIssues: z.array(z.enum(SOURCE_ISSUES)).max(SOURCE_ISSUES.length).optional(),
  sourceIssueOther: z.string().trim().max(200).optional().default(''),
  aiAnswer: z.string().optional().default(''),
  shareLink: z.string().optional().default(''),
  note: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  images: z.array(z.string()).optional().default([]),
  sourceMessageId: z.string().nullable().optional(),
  sourceDiaryId: z.string().nullable().optional(),
  revisionOfId: z.string().nullable().optional(),
  draftId: z.string().nullable().optional(),
  annotations: z.array(annotationSchema).optional().default([]),
})

const draftRequestSchema = z.object({
  id: z.string().length(32).optional(),
  sourceMessageId: z.string().length(32).nullable().optional(),
  sourceDiaryId: z.string().length(32).nullable().optional(),
  payload: z.object({}).passthrough(),
})

function mapSubmission(row) {
  return {
    ...row,
    tags: parseJson(row.tags, []),
    images: parseJson(row.images, []),
    errorTypes: parseJson(row.errorTypes, row.errorType ? [row.errorType] : []),
    knowledgeScenarios: parseJson(row.knowledgeScenarios, []),
    sourceIssues: parseJson(row.sourceIssues, row.sourceIssue && row.sourceIssue !== 'none' ? [row.sourceIssue] : []),
    annotations: parseJson(row.annotations, []),
    annotationCount: Number(row.annotationCount || 0),
    revisionNumber: Number(row.revisionNumber || 1),
    hasNewerRevision: toBoolean(row.hasNewerRevision),
  }
}

router.get('/drafts', authMiddleware, async (req, res) => {
  const rows = await query(
    `SELECT id, source_message_id AS sourceMessageId, source_diary_id AS sourceDiaryId,
            payload, created_at AS createdAt, updated_at AS updatedAt
     FROM case_drafts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100`,
    [req.user.id]
  )
  res.json({ code: 0, data: rows.map(item => ({ ...item, payload: parseJson(item.payload, {}) })) })
})

router.get('/drafts/:id', authMiddleware, async (req, res) => {
  const item = await one(
    `SELECT id, source_message_id AS sourceMessageId, source_diary_id AS sourceDiaryId,
            payload, updated_at AS updatedAt
     FROM case_drafts WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id]
  )
  if (!item) return res.status(404).json({ message: '草稿不存在' })
  res.json({ code: 0, data: { ...item, payload: parseJson(item.payload, {}) } })
})

router.post('/drafts', authMiddleware, async (req, res) => {
  const parsed = draftRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '草稿内容无效' })
  const { sourceMessageId = null, sourceDiaryId = null, payload } = parsed.data
  let id = parsed.data.id
  if (id) {
    const result = await query(
      `UPDATE case_drafts SET source_message_id = ?, source_diary_id = ?, payload = ?
       WHERE id = ? AND user_id = ?`,
      [sourceMessageId, sourceDiaryId, JSON.stringify(payload), id, req.user.id]
    )
    if (!result.affectedRows) return res.status(404).json({ message: '草稿不存在或无权操作' })
  } else {
    id = genId()
    await query(
      `INSERT INTO case_drafts (id, user_id, source_message_id, source_diary_id, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.user.id, sourceMessageId, sourceDiaryId, JSON.stringify(payload)]
    )
  }
  res.json({ code: 0, data: { id, updatedAt: new Date().toISOString() } })
})

router.delete('/drafts/:id', authMiddleware, async (req, res) => {
  await query('DELETE FROM case_drafts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  res.json({ code: 0, data: null })
})

router.get('/draft/from-revision/:submissionId', authMiddleware, async (req, res) => {
  const item = await one(
    `SELECT id, prompt, platform, platform_other AS platformOther, model, category,
            error_type AS errorType, error_types AS errorTypes, error_type_other AS errorTypeOther,
            knowledge_scenarios AS knowledgeScenarios, knowledge_scenario_other AS knowledgeScenarioOther,
            source_issue AS sourceIssue, source_issues AS sourceIssues, source_issue_other AS sourceIssueOther,
            ai_answer AS aiAnswer, share_link AS shareLink,
            note, tags, images,
            source_message_id AS sourceMessageId, source_diary_id AS sourceDiaryId,
            rejection_reason AS rejectionReason, revision_number AS revisionNumber,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'selectedText', a.selected_text, 'startOffset', a.start_offset, 'endOffset', a.end_offset,
              'prefixText', a.prefix_text, 'suffixText', a.suffix_text,
              'issueType', a.issue_type, 'comment', a.comment, 'source', a.source,
              'confidence', a.confidence
            )) FROM case_annotations a
                WHERE a.submission_id = submissions.id AND a.status = 'active'), JSON_ARRAY()) AS annotations
     FROM submissions WHERE id = ? AND user_id = ? AND status = 'rejected'`,
    [req.params.submissionId, req.user.id]
  )
  if (!item) return res.status(404).json({ message: '只能修改本人被退回的案例' })
  res.json({ code: 0, data: {
    ...item,
    revisionOfId: item.id,
    tags: parseJson(item.tags, []),
    images: parseJson(item.images, []),
    errorTypes: parseJson(item.errorTypes, item.errorType ? [item.errorType] : []),
    knowledgeScenarios: parseJson(item.knowledgeScenarios, []),
    sourceIssues: parseJson(item.sourceIssues, item.sourceIssue && item.sourceIssue !== 'none' ? [item.sourceIssue] : []),
    annotations: parseJson(item.annotations, []).map(annotation => ({
      ...annotation,
      confidence: annotation.confidence == null ? null : Number(annotation.confidence),
    })),
    platformLocked: Boolean(item.sourceMessageId || item.sourceDiaryId),
  } })
})

router.get('/draft/from-message/:messageId', authMiddleware, async (req, res) => {
  const assistant = await one(
    `SELECT m.id, m.content AS aiAnswer, m.provider AS platform, m.model, m.modality,
            m.created_at AS createdAt, c.id AS conversationId
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ? AND m.role = 'assistant' AND c.user_id = ?`,
    [req.params.messageId, req.user.id]
  )
  if (!assistant) return res.status(404).json({ message: '找不到该 AI 回复' })
  const userMessage = await one(
    `SELECT content FROM messages
     WHERE conversation_id = ? AND role = 'user' AND created_at <= ?
     ORDER BY created_at DESC LIMIT 1`,
    [assistant.conversationId, assistant.createdAt]
  )
  const sourceUserMessage = extractUserMessage(userMessage?.content)
  const contextRows = await query(
    `SELECT id, role, content, created_at AS createdAt FROM messages
     WHERE conversation_id = ? AND created_at <= ? ORDER BY created_at ASC`,
    [assistant.conversationId, assistant.createdAt]
  )
  res.json({
    code: 0,
    data: {
      sourceMessageId: assistant.id,
      prompt: sourceUserMessage.prompt,
      aiAnswer: assistant.aiAnswer,
      platform: assistant.platform,
      model: assistant.model,
      images: sourceUserMessage.imageUrl ? [sourceUserMessage.imageUrl] : [],
      contextMessages: contextRows.map(item => {
        const parsedContent = item.role === 'user' ? extractUserMessage(item.content) : { prompt: item.content, imageUrl: '' }
        return { id: item.id, role: item.role, content: parsedContent.prompt, imageUrl: parsedContent.imageUrl, createdAt: item.createdAt }
      }),
      platformLocked: true,
    },
  })
})

router.get('/draft/from-diary/:diaryId', authMiddleware, async (req, res) => {
  const diary = await one(
    `SELECT id, need_description AS prompt, outcome AS aiAnswer, genai_platform AS platform,
            is_genai_related AS isGenaiRelated
     FROM information_need_logs WHERE id = ? AND user_id = ?`,
    [req.params.diaryId, req.user.id]
  )
  if (!diary) return res.status(404).json({ message: '信息需求记录不存在' })
  if (!toBoolean(diary.isGenaiRelated)) return res.status(400).json({ message: '只有与 GenAI 有关的记录才能转为案例' })
  res.json({ code: 0, data: { ...diary, sourceDiaryId: diary.id, platformLocked: Boolean(diary.platform) } })
})

router.post('/import-text', authMiddleware, async (req, res) => {
  const parsed = z.object({
    text: z.string().trim().min(2).max(100000),
    platform: z.string().max(40).optional().default(''),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '请粘贴有效的对话内容' })
  if (!acquireAiSlot(req.user.id)) return res.status(429).json({ message: 'AI 请求较多，请稍后再试' })
  try {
    const result = await importConversationText(parsed.data.text, parsed.data.platform)
    res.json({ code: 0, data: result })
  } catch (error) {
    console.error('粘贴对话解析失败:', error.message)
    res.status(422).json({ message: '无法自动区分用户问题和 AI 回答，请改用手动填写' })
  } finally {
    releaseAiSlot(req.user.id)
  }
})

router.post('/import-screenshots', authMiddleware, upload.array('files', 4), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ message: '请选择对话截图' })
  if (!acquireAiSlot(req.user.id)) return res.status(429).json({ message: 'AI 请求较多，请稍后再试' })
  try {
    const result = await importConversationScreenshots(req.files, String(req.body.platform || ''))
    const stored = await Promise.all(req.files.map(storeUpload))
    res.json({ code: 0, data: { ...result, images: stored.map(item => item.url) } })
  } catch (error) {
    console.error('对话截图识别失败:', error.message)
    res.status(422).json({ message: '未能从截图中识别完整对话，请检查截图顺序或改用粘贴对话' })
  } finally {
    releaseAiSlot(req.user.id)
  }
})

router.post('/', authMiddleware, async (req, res) => {
  const parsed = submissionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '案例字段不完整或格式错误' })
  let data = parsed.data
  const normalizedTaxonomy = normalizeCaseTaxonomy(data)
  data = { ...data, ...normalizedTaxonomy }
  const taxonomyError = caseTaxonomyError(data)
  if (taxonomyError) return res.status(400).json({ message: taxonomyError })

  let revisionSource = null
  if (data.revisionOfId) {
    revisionSource = await one(
      `SELECT id, revision_number AS revisionNumber,
              EXISTS(SELECT 1 FROM submissions child WHERE child.revision_of_id = submissions.id) AS hasNewerRevision
       FROM submissions WHERE id = ? AND user_id = ? AND status = 'rejected'`,
      [data.revisionOfId, req.user.id]
    )
    if (!revisionSource) return res.status(400).json({ message: '原案例不存在、未被退回或不属于当前用户' })
    if (toBoolean(revisionSource.hasNewerRevision)) return res.status(409).json({ message: '该案例已有后续版本，请从最新的退回版本继续修改' })
  }

  if (!revisionSource) {
    const daily = await checkDailyLimit(req.user.id)
    if (daily.exceeded) return res.status(400).json({ message: '今日案例提交已达上限（5 条）' })
    const weekly = await checkWeeklyLimit(req.user.id)
    if (weekly.exceeded) return res.status(400).json({ message: '本周案例提交已达上限（20 条）' })
  }

  if (!data.annotations.length && !data.note.trim()) {
    return res.status(400).json({ message: '请至少添加一条片段批注或填写整体问题说明' })
  }

  if (data.sourceMessageId) {
    const source = await one(
      `SELECT m.content AS aiAnswer, m.provider AS platform, m.model, m.created_at AS createdAt,
              c.id AS conversationId
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = ? AND m.role = 'assistant' AND c.user_id = ?`,
      [data.sourceMessageId, req.user.id]
    )
    if (!source) return res.status(400).json({ message: '原始 AI 回复不存在或无权访问' })
    const userMessage = await one(
      `SELECT content FROM messages WHERE conversation_id = ? AND role = 'user' AND created_at <= ?
       ORDER BY created_at DESC LIMIT 1`,
      [source.conversationId, source.createdAt]
    )
    data = lockSubmissionToMessage(data, source, userMessage?.content)
  }

  if (data.sourceDiaryId) {
    const diary = await one(
      'SELECT is_genai_related AS isGenaiRelated, genai_platform AS platform FROM information_need_logs WHERE id = ? AND user_id = ?',
      [data.sourceDiaryId, req.user.id]
    )
    if (!diary || !toBoolean(diary.isGenaiRelated)) return res.status(400).json({ message: '日记来源无效' })
    if (diary.platform) data.platform = diary.platform
  }

  if (!data.prompt.trim() || !data.platform.trim() || !data.aiAnswer.trim()) {
    return res.status(400).json({ message: 'Prompt、AI 平台和 AI 回答为必填项' })
  }
  if (data.platform === 'other' && !data.platformOther.trim()) {
    return res.status(400).json({ message: '选择“其他”平台时，请填写具体平台名称' })
  }
  const annotationError = annotationIntegrityError(data.aiAnswer, data.annotations)
  if (annotationError) return res.status(400).json({ message: annotationError })

  const id = genId()
  try {
    await transaction(async connection => {
      await connection.execute(
        `INSERT INTO submissions
         (id, user_id, prompt, platform, platform_other, model, ai_answer, category,
          error_type, error_types, error_type_other, knowledge_scenarios, knowledge_scenario_other,
          source_issue, source_issues, source_issue_other, share_link, satisfaction,
          is_good_case, note, tags, images, source_message_id, source_diary_id, status,
          published_at, rejection_reason, revision_of_id, revision_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, 'published',
                 CURRENT_TIMESTAMP(3), '', ?, ?)`,
        [id, req.user.id, data.prompt, data.platform, data.platformOther, data.model, data.aiAnswer,
          data.errorTypes[0], data.errorTypes[0], JSON.stringify(data.errorTypes), data.errorTypeOther,
          JSON.stringify(data.knowledgeScenarios), data.knowledgeScenarioOther,
          data.sourceIssues[0] || 'none', JSON.stringify(data.sourceIssues), data.sourceIssueOther,
          data.shareLink, data.note,
          JSON.stringify(data.tags), JSON.stringify(data.images), data.sourceMessageId || null, data.sourceDiaryId || null,
          revisionSource?.id || null, revisionSource ? Number(revisionSource.revisionNumber) + 1 : 1]
      )
      for (const item of data.annotations) {
        await connection.execute(
          `INSERT INTO case_annotations
           (id, submission_id, user_id, selected_text, start_offset, end_offset, prefix_text, suffix_text,
            issue_type, comment, source, confidence)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [genId(), id, req.user.id, item.selectedText, item.startOffset, item.endOffset, item.prefixText,
            item.suffixText, item.issueType, item.comment, item.source, item.confidence ?? null]
        )
      }
      if (data.draftId) {
        await connection.execute('DELETE FROM case_drafts WHERE id = ? AND user_id = ?', [data.draftId, req.user.id])
      }
    })
  } catch (error) {
    if (revisionSource && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '该案例已有后续版本，请刷新后查看' })
    }
    throw error
  }

  res.json({ code: 0, data: { id, status: 'published' } })
})

router.get('/my', authMiddleware, async (req, res) => {
  const rows = await query(
    `SELECT s.id, s.prompt, s.platform, s.platform_other AS platformOther, s.model, s.category,
            s.error_type AS errorType, s.error_types AS errorTypes, s.error_type_other AS errorTypeOther,
            s.knowledge_scenarios AS knowledgeScenarios, s.knowledge_scenario_other AS knowledgeScenarioOther,
            s.source_issue AS sourceIssue, s.source_issues AS sourceIssues, s.source_issue_other AS sourceIssueOther,
            s.ai_answer AS aiAnswer, s.note, s.tags, s.images, s.status,
            s.withdrawn_reason AS withdrawnReason,
            s.rejection_reason AS rejectionReason, s.revision_of_id AS revisionOfId,
            s.revision_number AS revisionNumber,
            EXISTS(SELECT 1 FROM submissions child WHERE child.revision_of_id = s.id) AS hasNewerRevision,
            s.like_count AS likeCount, s.comment_count AS commentCount, s.created_at AS createdAt,
            (SELECT COUNT(1) FROM case_annotations a WHERE a.submission_id = s.id AND a.status = 'active') AS annotationCount,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'id', a.id, 'selectedText', a.selected_text, 'startOffset', a.start_offset,
              'endOffset', a.end_offset, 'prefixText', a.prefix_text, 'suffixText', a.suffix_text,
              'issueType', a.issue_type, 'comment', a.comment, 'source', a.source,
              'confidence', a.confidence, 'author', COALESCE(au.name, u.name),
              'agreeCount', a.agree_count, 'disagreeCount', a.disagree_count,
              'commentCount', a.comment_count
            )) FROM case_annotations a LEFT JOIN users au ON au.id = a.user_id
                WHERE a.submission_id = s.id AND a.status = 'active'), JSON_ARRAY()) AS annotations
     FROM submissions s JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 100`,
    [req.user.id]
  )
  res.json({ code: 0, data: { list: rows.map(mapSubmission), stats: await calculateStats(req.user.id) } })
})

router.delete('/:id', authMiddleware, async (req, res) => {
  const item = await one(
    `SELECT user_id AS userId, status, revision_of_id AS revisionOfId,
            EXISTS(SELECT 1 FROM submissions child WHERE child.revision_of_id = submissions.id) AS hasNewerRevision
     FROM submissions WHERE id = ?`,
    [req.params.id]
  )
  if (!item) return res.status(404).json({ message: '该案例不存在' })
  if (item.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: '无权删除该案例' })
  if (item.status === 'published' || item.status === 'withdrawn') {
    return res.status(409).json({ message: '已发布案例需由管理员撤回，不能直接删除' })
  }
  if (!canDeleteSubmissionVersion(item.revisionOfId, item.hasNewerRevision)) {
    return res.status(409).json({ message: '版本化案例需要保留完整历史，不能删除' })
  }
  await query('DELETE FROM submissions WHERE id = ?', [req.params.id])
  res.json({ code: 0, data: null })
})

export default router
