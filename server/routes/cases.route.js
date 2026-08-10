import { Router } from 'express'
import { z } from 'zod'
import { genId, one, query, transaction } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { writeAudit } from '../audit.js'
import { annotationIntegrityError } from '../services/submissionIntegrity.js'
import { canVoteOnAnnotation, canWithdrawAnnotation } from '../services/teachingPolicy.js'
import { parseJson, toBoolean } from '../utils/data.js'
import { ERROR_TYPES } from '../services/caseTaxonomy.js'

const router = Router()
router.use(authMiddleware)

const collaborativeAnnotationSchema = z.object({
  selectedText: z.string().min(1).max(10000),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  issueType: z.enum(ERROR_TYPES),
  comment: z.string().trim().min(1).max(4000),
})
const annotationVoteSchema = z.object({ vote: z.enum(['agree', 'disagree']) })

function mapAnnotation(item) {
  return {
    ...item,
    agreeCount: Number(item.agreeCount || 0),
    disagreeCount: Number(item.disagreeCount || 0),
    commentCount: Number(item.commentCount || 0),
  }
}

function mapCase(row) {
  return {
    ...row,
    isGoodCase: toBoolean(row.isGoodCase),
    liked: toBoolean(row.liked),
    tags: parseJson(row.tags, []),
    images: parseJson(row.images, []),
    errorTypes: parseJson(row.errorTypes, row.errorType ? [row.errorType] : []),
    knowledgeScenarios: parseJson(row.knowledgeScenarios, []),
    sourceIssues: parseJson(row.sourceIssues, row.sourceIssue && row.sourceIssue !== 'none' ? [row.sourceIssue] : []),
    annotations: parseJson(row.annotations, []).map(mapAnnotation),
    annotationCount: Number(row.annotationCount || 0),
    annotationAgreeCount: Number(row.annotationAgreeCount || 0),
    annotationDisagreeCount: Number(row.annotationDisagreeCount || 0),
    annotationCommentCount: Number(row.annotationCommentCount || 0),
  }
}

async function getPublishedCase(id) {
  return one("SELECT id, ai_answer AS aiAnswer FROM submissions WHERE id = ? AND status = 'published'", [id])
}

async function getPublishedAnnotation(caseId, annotationId) {
  return one(
    `SELECT a.id, a.user_id AS userId FROM case_annotations a JOIN submissions s ON s.id = a.submission_id
     WHERE a.id = ? AND a.submission_id = ? AND a.status = 'active' AND s.status = 'published'`,
    [annotationId, caseId]
  )
}

router.get('/', async (req, res) => {
  const { category, errorType, knowledgeScenario, sourceIssue, keyword, sortBy = 'latest', caseId, mine } = req.query
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12))
  const where = ["s.status = 'published'"]
  const params = []

  if (caseId) {
    where.push('s.id = ?')
    params.push(caseId)
  }
  if (mine === '1') {
    where.push('s.user_id = ?')
    params.push(req.user.id)
  }

  const selectedErrorType = errorType || category
  if (selectedErrorType) {
    where.push('JSON_CONTAINS(COALESCE(s.error_types, JSON_ARRAY(s.error_type)), JSON_QUOTE(?))')
    params.push(selectedErrorType)
  }
  if (knowledgeScenario) {
    where.push('JSON_CONTAINS(COALESCE(s.knowledge_scenarios, JSON_ARRAY()), JSON_QUOTE(?))')
    params.push(knowledgeScenario)
  }
  if (sourceIssue) {
    where.push("JSON_CONTAINS(COALESCE(s.source_issues, IF(s.source_issue = 'none', JSON_ARRAY(), JSON_ARRAY(s.source_issue))), JSON_QUOTE(?))")
    params.push(sourceIssue)
  }
  if (keyword) {
    where.push('(s.prompt LIKE ? OR s.note LIKE ? OR JSON_SEARCH(s.tags, \'one\', ?) IS NOT NULL)')
    const like = `%${keyword}%`
    params.push(like, like, like)
  }

  const condition = `WHERE ${where.join(' AND ')}`
  const count = await one(`SELECT COUNT(1) AS total FROM submissions s ${condition}`, params)
  const order = sortBy === 'hot'
    ? "COALESCE((SELECT SUM(a.agree_count + a.disagree_count + a.comment_count) FROM case_annotations a WHERE a.submission_id = s.id AND a.status = 'active'), 0) DESC, s.created_at DESC"
    : sortBy === 'controversial'
      ? "COALESCE((SELECT SUM(LEAST(a.agree_count, a.disagree_count) * 2 + a.disagree_count) FROM case_annotations a WHERE a.submission_id = s.id AND a.status = 'active'), 0) DESC, s.created_at DESC"
      : 's.created_at DESC'
  const rows = await query(
    `SELECT s.id, u.name AS author, s.prompt, s.platform, s.platform_other AS platformOther,
            s.model, s.category, s.error_type AS errorType, s.error_types AS errorTypes,
            s.error_type_other AS errorTypeOther, s.knowledge_scenarios AS knowledgeScenarios,
            s.knowledge_scenario_other AS knowledgeScenarioOther, s.source_issue AS sourceIssue,
            s.source_issues AS sourceIssues, s.source_issue_other AS sourceIssueOther,
            s.ai_answer AS aiAnswer,
            s.note, s.tags, s.images, s.like_count AS likeCount, s.comment_count AS commentCount,
            s.created_at AS createdAt,
            EXISTS(SELECT 1 FROM likes l WHERE l.case_id = s.id AND l.user_id = ?) AS liked,
            (SELECT COUNT(1) FROM case_annotations ac WHERE ac.submission_id = s.id AND ac.status = 'active') AS annotationCount,
            COALESCE((SELECT SUM(ac.agree_count) FROM case_annotations ac WHERE ac.submission_id = s.id AND ac.status = 'active'), 0) AS annotationAgreeCount,
            COALESCE((SELECT SUM(ac.disagree_count) FROM case_annotations ac WHERE ac.submission_id = s.id AND ac.status = 'active'), 0) AS annotationDisagreeCount,
            COALESCE((SELECT SUM(ac.comment_count) FROM case_annotations ac WHERE ac.submission_id = s.id AND ac.status = 'active'), 0) AS annotationCommentCount,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'id', a.id, 'selectedText', a.selected_text, 'startOffset', a.start_offset,
              'endOffset', a.end_offset, 'issueType', a.issue_type, 'comment', a.comment,
              'source', a.source, 'confidence', a.confidence,
              'author', COALESCE(au.name, u.name), 'agreeCount', a.agree_count,
              'disagreeCount', a.disagree_count,
              'commentCount', a.comment_count,
              'isOwn', (a.user_id = ?),
              'userVote', (SELECT al.vote FROM annotation_likes al WHERE al.annotation_id = a.id AND al.user_id = ?)
            )) FROM case_annotations a LEFT JOIN users au ON au.id = a.user_id
                WHERE a.submission_id = s.id AND a.status = 'active'), JSON_ARRAY()) AS annotations
     FROM submissions s JOIN users u ON u.id = s.user_id
     ${condition} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [req.user.id, req.user.id, req.user.id, ...params, pageSize, (page - 1) * pageSize]
  )
  res.json({ code: 0, data: { list: rows.map(mapCase), total: Number(count.total) } })
})

router.post('/:id/annotations', async (req, res) => {
  const parsed = collaborativeAnnotationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '批注内容或位置无效' })
  const caseItem = await getPublishedCase(req.params.id)
  if (!caseItem) return res.status(404).json({ message: '案例不存在或尚未发布' })

  const data = parsed.data
  const existing = await query(
    `SELECT selected_text AS selectedText, start_offset AS startOffset, end_offset AS endOffset
     FROM case_annotations WHERE submission_id = ? AND status = 'active'`,
    [req.params.id]
  )
  const integrityError = annotationIntegrityError(caseItem.aiAnswer, [...existing, data])
  if (integrityError) return res.status(400).json({ message: integrityError })

  const id = genId()
  const prefixText = caseItem.aiAnswer.slice(Math.max(0, data.startOffset - 40), data.startOffset)
  const suffixText = caseItem.aiAnswer.slice(data.endOffset, data.endOffset + 40)
  await query(
    `INSERT INTO case_annotations
     (id, submission_id, user_id, selected_text, start_offset, end_offset, prefix_text, suffix_text,
      issue_type, comment, source, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', NULL)`,
    [id, req.params.id, req.user.id, data.selectedText, data.startOffset, data.endOffset,
      prefixText, suffixText, data.issueType, data.comment]
  )
  res.json({ code: 0, data: mapAnnotation({
    id,
    selectedText: data.selectedText,
    startOffset: data.startOffset,
    endOffset: data.endOffset,
    prefixText,
    suffixText,
    issueType: data.issueType,
    comment: data.comment,
    source: 'user',
    confidence: null,
    author: req.user.name,
    userVote: null,
    agreeCount: 0,
    disagreeCount: 0,
    commentCount: 0,
    isOwn: true,
  }) })
})

router.post('/:id/annotations/:annotationId/vote', async (req, res) => {
  const parsed = annotationVoteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '投票选项无效' })
  const annotation = await getPublishedAnnotation(req.params.id, req.params.annotationId)
  if (!annotation) return res.status(404).json({ message: '批注不存在' })
  if (!canVoteOnAnnotation(req.user.id, annotation.userId)) return res.status(403).json({ message: '不能为自己的批注投票' })
  const selectedVote = parsed.data.vote
  const userVote = await transaction(async connection => {
    const [rows] = await connection.execute(
      'SELECT vote FROM annotation_likes WHERE annotation_id = ? AND user_id = ? FOR UPDATE',
      [annotation.id, req.user.id]
    )
    const previousVote = rows[0]?.vote || null
    const selectedColumn = selectedVote === 'agree' ? 'agree_count' : 'disagree_count'
    if (previousVote === selectedVote) {
      await connection.execute('DELETE FROM annotation_likes WHERE annotation_id = ? AND user_id = ?', [annotation.id, req.user.id])
      await connection.execute(`UPDATE case_annotations SET ${selectedColumn} = GREATEST(0, ${selectedColumn} - 1) WHERE id = ?`, [annotation.id])
      return null
    }
    if (previousVote) {
      const previousColumn = previousVote === 'agree' ? 'agree_count' : 'disagree_count'
      await connection.execute('UPDATE annotation_likes SET vote = ? WHERE annotation_id = ? AND user_id = ?', [selectedVote, annotation.id, req.user.id])
      await connection.execute(
        `UPDATE case_annotations SET ${previousColumn} = GREATEST(0, ${previousColumn} - 1), ${selectedColumn} = ${selectedColumn} + 1 WHERE id = ?`,
        [annotation.id]
      )
    } else {
      await connection.execute('INSERT INTO annotation_likes (annotation_id, user_id, vote) VALUES (?, ?, ?)', [annotation.id, req.user.id, selectedVote])
      await connection.execute(`UPDATE case_annotations SET ${selectedColumn} = ${selectedColumn} + 1 WHERE id = ?`, [annotation.id])
    }
    return selectedVote
  })
  const updated = await one('SELECT agree_count AS agreeCount, disagree_count AS disagreeCount FROM case_annotations WHERE id = ?', [annotation.id])
  res.json({ code: 0, data: {
    userVote,
    agreeCount: Number(updated.agreeCount),
    disagreeCount: Number(updated.disagreeCount),
  } })
})

router.delete('/:id/annotations/:annotationId', async (req, res) => {
  const annotation = req.user.role === 'admin'
    ? await one(
        `SELECT id, user_id AS userId FROM case_annotations
         WHERE id = ? AND submission_id = ? AND status = 'active'`,
        [req.params.annotationId, req.params.id]
      )
    : await getPublishedAnnotation(req.params.id, req.params.annotationId)
  if (!annotation) return res.status(404).json({ message: '批注不存在或已撤回' })
  if (!canWithdrawAnnotation(req.user, annotation.userId)) {
    return res.status(403).json({ message: '只能撤回自己的批注' })
  }
  await query(
    `UPDATE case_annotations
     SET status = 'withdrawn', withdrawn_at = CURRENT_TIMESTAMP(3), withdrawn_by_user_id = ?
     WHERE id = ? AND status = 'active'`,
    [req.user.id, annotation.id]
  )
  await writeAudit(req.user.id, 'annotation.withdraw', 'case_annotation', annotation.id, { submissionId: req.params.id })
  res.json({ code: 0, data: null })
})

router.get('/:id/annotations/:annotationId/comments', async (req, res) => {
  const annotation = await getPublishedAnnotation(req.params.id, req.params.annotationId)
  if (!annotation) return res.status(404).json({ message: '批注不存在' })
  const comments = await query(
    `SELECT c.id, u.name AS author, c.content, c.parent_comment_id AS parentCommentId,
            c.root_comment_id AS rootCommentId, pu.name AS replyToAuthor,
            c.created_at AS createdAt, c.deleted_at AS deletedAt,
            (c.deleted_at IS NULL AND (c.user_id = ? OR ? = 'admin')) AS canManage
     FROM annotation_comments c JOIN users u ON u.id = c.user_id
     LEFT JOIN annotation_comments pc ON pc.id = c.parent_comment_id
     LEFT JOIN users pu ON pu.id = pc.user_id
     LEFT JOIN annotation_comments rc ON rc.id = c.root_comment_id
     WHERE c.annotation_id = ?
       AND (c.deleted_at IS NULL OR EXISTS (
         SELECT 1 FROM annotation_comments child
         WHERE (child.parent_comment_id = c.id OR child.root_comment_id = c.id)
           AND child.deleted_at IS NULL
       ))
     ORDER BY COALESCE(rc.created_at, c.created_at),
              CASE WHEN c.parent_comment_id IS NULL THEN 0 ELSE 1 END,
              c.created_at ASC`,
    [req.user.id, req.user.role, annotation.id]
  )
  const mapped = comments.map(item => ({
    ...item,
    content: item.deletedAt ? '' : item.content,
    canManage: toBoolean(item.canManage),
    deleted: Boolean(item.deletedAt),
    replies: [],
  }))
  const roots = []
  const rootMap = new Map()
  for (const item of mapped) {
    if (!item.parentCommentId) {
      roots.push(item)
      rootMap.set(item.id, item)
    }
  }
  for (const item of mapped) {
    if (!item.parentCommentId) continue
    const root = rootMap.get(item.rootCommentId) || rootMap.get(item.parentCommentId)
    if (root) root.replies.push(item)
    else roots.push(item)
  }
  res.json({ code: 0, data: roots })
})

router.post('/:id/annotations/:annotationId/comments', async (req, res) => {
  const content = String(req.body.content || '').trim()
  const parentCommentId = req.body.parentCommentId ? String(req.body.parentCommentId) : null
  if (!content) return res.status(400).json({ message: '评论内容不能为空' })
  if (content.length > 4000) return res.status(400).json({ message: '评论内容不能超过 4000 字' })
  const annotation = await getPublishedAnnotation(req.params.id, req.params.annotationId)
  if (!annotation) return res.status(404).json({ message: '批注不存在' })
  let parent = null
  if (parentCommentId) {
    parent = await one(
      `SELECT c.id, c.root_comment_id AS rootCommentId, c.deleted_at AS deletedAt, u.name AS author
       FROM annotation_comments c JOIN users u ON u.id = c.user_id
       WHERE c.id = ? AND c.annotation_id = ?`,
      [parentCommentId, annotation.id]
    )
    if (!parent || parent.deletedAt) return res.status(400).json({ message: '要回复的评论不存在或已删除' })
  }

  const id = genId()
  const rootCommentId = parent ? parent.rootCommentId || parent.id : null
  await transaction(async connection => {
    await connection.execute(
      `INSERT INTO annotation_comments
       (id, annotation_id, user_id, parent_comment_id, root_comment_id, content)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, annotation.id, req.user.id, parent?.id || null, rootCommentId, content]
    )
    await connection.execute('UPDATE case_annotations SET comment_count = comment_count + 1 WHERE id = ?', [annotation.id])
  })
  res.json({ code: 0, data: {
    id, author: req.user.name, content, parentCommentId: parent?.id || null,
    rootCommentId, replyToAuthor: parent?.author || '', createdAt: new Date().toISOString(),
    canManage: true, deleted: false, replies: [],
  } })
})

router.put('/:id/annotations/:annotationId/comments/:commentId', async (req, res) => {
  const content = String(req.body.content || '').trim()
  if (!content) return res.status(400).json({ message: '评论内容不能为空' })
  if (content.length > 4000) return res.status(400).json({ message: '评论内容不能超过 4000 字' })
  const annotation = await getPublishedAnnotation(req.params.id, req.params.annotationId)
  if (!annotation) return res.status(404).json({ message: '批注不存在' })
  const comment = await one(
    'SELECT id, user_id AS userId, deleted_at AS deletedAt FROM annotation_comments WHERE id = ? AND annotation_id = ?',
    [req.params.commentId, annotation.id]
  )
  if (!comment) return res.status(404).json({ message: '评论不存在' })
  if (comment.deletedAt) return res.status(400).json({ message: '已删除的评论不能修改' })
  if (comment.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: '只能修改自己的评论' })
  await query('UPDATE annotation_comments SET content = ? WHERE id = ?', [content, comment.id])
  if (req.user.role === 'admin') await writeAudit(req.user.id, 'annotation-comment.update', 'annotation_comment', comment.id)
  res.json({ code: 0, data: { id: comment.id, content } })
})

router.delete('/:id/annotations/:annotationId/comments/:commentId', async (req, res) => {
  const annotation = await getPublishedAnnotation(req.params.id, req.params.annotationId)
  if (!annotation) return res.status(404).json({ message: '批注不存在' })
  const comment = await one(
    'SELECT id, user_id AS userId, deleted_at AS deletedAt FROM annotation_comments WHERE id = ? AND annotation_id = ?',
    [req.params.commentId, annotation.id]
  )
  if (!comment) return res.status(404).json({ message: '评论不存在' })
  if (comment.deletedAt) return res.status(400).json({ message: '评论已经删除' })
  if (comment.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: '只能删除自己的评论' })
  await transaction(async connection => {
    const [replyRows] = await connection.execute(
      'SELECT COUNT(1) AS total FROM annotation_comments WHERE (parent_comment_id = ? OR root_comment_id = ?) AND deleted_at IS NULL',
      [comment.id, comment.id]
    )
    if (Number(replyRows[0]?.total || 0) > 0) {
      await connection.execute(
        `UPDATE annotation_comments
         SET content = '', deleted_at = CURRENT_TIMESTAMP(3), deleted_by_user_id = ? WHERE id = ?`,
        [req.user.id, comment.id]
      )
    } else {
      await connection.execute('DELETE FROM annotation_comments WHERE id = ?', [comment.id])
    }
    await connection.execute('UPDATE case_annotations SET comment_count = GREATEST(0, comment_count - 1) WHERE id = ?', [annotation.id])
  })
  if (req.user.role === 'admin') await writeAudit(req.user.id, 'annotation-comment.delete', 'annotation_comment', comment.id)
  res.json({ code: 0, data: null })
})

router.post('/:id/like', async (req, res) => {
  const item = await one("SELECT id FROM submissions WHERE id = ? AND status = 'published'", [req.params.id])
  if (!item) return res.status(404).json({ message: '案例不存在' })
  const existing = await one('SELECT 1 AS found FROM likes WHERE case_id = ? AND user_id = ?', [req.params.id, req.user.id])
  await transaction(async connection => {
    if (existing) {
      await connection.execute('DELETE FROM likes WHERE case_id = ? AND user_id = ?', [req.params.id, req.user.id])
      await connection.execute('UPDATE submissions SET like_count = GREATEST(0, like_count - 1) WHERE id = ?', [req.params.id])
    } else {
      await connection.execute('INSERT INTO likes (case_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id])
      await connection.execute('UPDATE submissions SET like_count = like_count + 1 WHERE id = ?', [req.params.id])
    }
  })
  const updated = await one('SELECT like_count AS likeCount FROM submissions WHERE id = ?', [req.params.id])
  res.json({ code: 0, data: { liked: !existing, likeCount: Number(updated.likeCount) } })
})

router.get('/:id/comments', async (req, res) => {
  const item = await getPublishedCase(req.params.id)
  if (!item) return res.status(404).json({ message: '案例不存在或已撤回' })
  const comments = await query(
    `SELECT c.id, u.name AS author, c.content, c.created_at AS createdAt
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.case_id = ? ORDER BY c.created_at DESC`,
    [req.params.id]
  )
  res.json({ code: 0, data: comments })
})

router.post('/:id/comments', async (req, res) => {
  const content = String(req.body.content || '').trim()
  if (!content) return res.status(400).json({ message: '评论内容不能为空' })
  if (content.length > 4000) return res.status(400).json({ message: '评论内容不能超过 4000 字' })
  const item = await getPublishedCase(req.params.id)
  if (!item) return res.status(404).json({ message: '案例不存在或已撤回' })
  const id = genId()
  await transaction(async connection => {
    await connection.execute('INSERT INTO comments (id, case_id, user_id, content) VALUES (?, ?, ?, ?)', [id, req.params.id, req.user.id, content])
    await connection.execute('UPDATE submissions SET comment_count = comment_count + 1 WHERE id = ?', [req.params.id])
  })
  res.json({ code: 0, data: { id, author: req.user.name, content, createdAt: new Date().toISOString() } })
})

export default router
