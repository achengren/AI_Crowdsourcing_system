import { Router } from 'express'
import bcrypt from 'bcryptjs'
import ExcelJS from 'exceljs'
import { parse as parseCsv } from 'csv-parse/sync'
import { z } from 'zod'
import { genId, one, query, transaction } from '../db.js'
import { authMiddleware, memoryUpload, requireAdmin } from '../middleware.js'
import { writeAudit } from '../audit.js'
import { parseJson, toBoolean } from '../utils/data.js'
import { parseImageContent } from '../utils/image.js'
import { canPublishSubmissionVersion, caseReviewError } from '../services/teachingPolicy.js'

const router = Router()
router.use(authMiddleware, requireAdmin)

const userSchema = z.object({
  studentId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8),
  role: z.enum(['student', 'admin']).optional().default('student'),
  className: z.string().trim().max(100).optional().default(''),
})

function pagination(req) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

router.get('/overview', async (_req, res) => {
  const [users, cases, diaries, messages] = await Promise.all([
    one("SELECT COUNT(1) AS total, SUM(status = 'active') AS active FROM users WHERE role = 'student'"),
    one("SELECT COUNT(1) AS total, SUM(status = 'submitted') AS pending FROM submissions"),
    one("SELECT COUNT(1) AS total, SUM(log_date = CURRENT_DATE() AND status = 'submitted') AS today FROM information_need_logs"),
    one('SELECT COUNT(1) AS total FROM messages'),
  ])
  res.json({ code: 0, data: { users, cases, diaries, messages } })
})

router.get('/users', async (req, res) => {
  const { page, pageSize, offset } = pagination(req)
  const where = ['1=1']
  const params = []
  if (req.query.keyword) {
    where.push('(student_id LIKE ? OR name LIKE ?)')
    params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`)
  }
  if (req.query.role) { where.push('role = ?'); params.push(req.query.role) }
  if (req.query.status) { where.push('status = ?'); params.push(req.query.status) }
  const condition = `WHERE ${where.join(' AND ')}`
  const total = await one(`SELECT COUNT(1) AS total FROM users ${condition}`, params)
  const list = await query(
    `SELECT id, student_id AS studentId, name, role, status, class_name AS className,
            last_login_at AS lastLoginAt,
            created_at AS createdAt FROM users ${condition}
     ORDER BY role DESC, class_name, student_id LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )
  res.json({ code: 0, data: { list, total: Number(total.total), page } })
})

router.post('/users', async (req, res) => {
  const parsed = userSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '账号信息不完整，初始密码至少 8 位' })
  const data = parsed.data
  try {
    const id = genId()
    await query(
      'INSERT INTO users (id, student_id, name, password_hash, role, class_name, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [id, data.studentId, data.name, bcrypt.hashSync(data.password, 12), data.role, data.className]
    )
    await writeAudit(req.user.id, 'user.create', 'user', id, { studentId: data.studentId, role: data.role })
    res.json({ code: 0, data: { id } })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '该账号已存在' })
    throw error
  }
})

router.put('/users/:id', async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(100),
    role: z.enum(['student', 'admin']),
    status: z.enum(['active', 'disabled']),
    className: z.string().trim().max(100).optional().default(''),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '账号字段无效' })
  if (req.params.id === req.user.id && (parsed.data.status === 'disabled' || parsed.data.role !== 'admin')) {
    return res.status(400).json({ message: '不能停用自己或移除自己的管理员权限' })
  }
  const result = await query(
    'UPDATE users SET name = ?, role = ?, status = ?, class_name = ? WHERE id = ?',
    [parsed.data.name, parsed.data.role, parsed.data.status, parsed.data.className, req.params.id]
  )
  if (!result.affectedRows) return res.status(404).json({ message: '账号不存在' })
  await writeAudit(req.user.id, 'user.update', 'user', req.params.id, parsed.data)
  res.json({ code: 0, data: null })
})

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: '不能停用当前管理员账号' })
  const result = await query("UPDATE users SET status = 'disabled' WHERE id = ?", [req.params.id])
  if (!result.affectedRows) return res.status(404).json({ message: '账号不存在' })
  await writeAudit(req.user.id, 'user.disable', 'user', req.params.id)
  res.json({ code: 0, data: null })
})

router.post('/users/:id/reset-password', async (req, res) => {
  const parsed = z.object({ password: z.string().min(8) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '新密码至少 8 位' })
  const result = await query(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    [bcrypt.hashSync(parsed.data.password, 12), req.params.id]
  )
  if (!result.affectedRows) return res.status(404).json({ message: '账号不存在' })
  await writeAudit(req.user.id, 'user.reset_password', 'user', req.params.id)
  res.json({ code: 0, data: null })
})

router.post('/users/import', memoryUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择 CSV 或 XLSX 文件' })
  let records = []
  if (req.file.originalname.toLowerCase().endsWith('.csv')) {
    records = parseCsv(req.file.buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true })
  } else {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(req.file.buffer)
    const worksheet = workbook.worksheets[0]
    const headers = []
    worksheet.getRow(1).eachCell((cell, index) => { headers[index] = String(cell.value || '').trim() })
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return
      const item = {}
      row.eachCell((cell, index) => { item[headers[index]] = String(cell.value || '').trim() })
      records.push(item)
    })
  }

  const normalized = records.map(item => ({
    studentId: item.studentId || item['账号'] || item['学号'],
    name: item.name || item['姓名'],
    password: item.password || item['初始密码'],
    role: item.role || item['角色'] || 'student',
    className: item.className || item['班级'] || '',
  }))
  const valid = normalized.map(item => userSchema.safeParse(item))
  if (valid.some(item => !item.success)) return res.status(400).json({ message: '导入文件存在缺失字段或短于 8 位的密码' })

  let created = 0
  let skipped = 0
  await transaction(async connection => {
    for (const item of valid.map(result => result.data)) {
      const [existing] = await connection.execute('SELECT id FROM users WHERE student_id = ?', [item.studentId])
      if (existing.length) { skipped += 1; continue }
      await connection.execute(
        'INSERT INTO users (id, student_id, name, password_hash, role, class_name, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [genId(), item.studentId, item.name, bcrypt.hashSync(item.password, 12), item.role, item.className]
      )
      created += 1
    }
  })
  await writeAudit(req.user.id, 'user.import', 'user', '', { created, skipped })
  res.json({ code: 0, data: { created, skipped } })
})

router.get('/conversations', async (req, res) => {
  const { page, pageSize, offset } = pagination(req)
  const params = []
  let condition = 'WHERE 1=1'
  if (req.query.keyword) {
    condition += ' AND (u.student_id LIKE ? OR u.name LIKE ? OR c.title LIKE ?)'
    const value = `%${req.query.keyword}%`
    params.push(value, value, value)
  }
  const total = await one(`SELECT COUNT(1) AS total FROM conversations c JOIN users u ON u.id = c.user_id ${condition}`, params)
  const list = await query(
    `SELECT c.id, c.title, c.created_at AS createdAt, c.updated_at AS updatedAt,
            u.id AS userId, u.student_id AS studentId, u.name,
            COUNT(m.id) AS messageCount
     FROM conversations c JOIN users u ON u.id = c.user_id
     LEFT JOIN messages m ON m.conversation_id = c.id ${condition}
     GROUP BY c.id ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )
  res.json({ code: 0, data: { list, total: Number(total.total), page } })
})

router.get('/conversations/:id/messages', async (req, res) => {
  const list = await query(
    `SELECT m.id, m.role, m.content, m.vision_context AS visionContext,
            m.provider, m.model, m.modality,
            m.thinking_enabled AS thinkingEnabled, m.created_at AS createdAt
     FROM messages m WHERE m.conversation_id = ? ORDER BY m.created_at`,
    [req.params.id]
  )
  await writeAudit(req.user.id, 'conversation.view', 'conversation', req.params.id)
  res.json({ code: 0, data: list.map(item => {
    const parsed = item.role === 'user' ? parseImageContent(item.content) : { imageUrl: null, text: item.content }
    return { ...item, content: parsed.text, imageUrl: parsed.imageUrl }
  }) })
})

router.get('/cases', async (req, res) => {
  const { page, pageSize, offset } = pagination(req)
  const params = []
  let condition = 'WHERE 1=1'
  if (req.query.status) { condition += ' AND s.status = ?'; params.push(req.query.status) }
  if (req.query.keyword) {
    condition += ' AND (u.student_id LIKE ? OR u.name LIKE ? OR s.prompt LIKE ?)'
    const value = `%${req.query.keyword}%`
    params.push(value, value, value)
  }
  const total = await one(`SELECT COUNT(1) AS total FROM submissions s JOIN users u ON u.id = s.user_id ${condition}`, params)
  const list = await query(
    `SELECT s.id, s.prompt, s.platform, s.model, s.category, s.status, s.note,
            s.rejection_reason AS rejectionReason, s.revision_of_id AS revisionOfId,
            s.revision_number AS revisionNumber,
            s.created_at AS createdAt, u.student_id AS studentId, u.name,
            COUNT(a.id) AS annotationCount
     FROM submissions s JOIN users u ON u.id = s.user_id
     LEFT JOIN case_annotations a ON a.submission_id = s.id AND a.status = 'active' ${condition}
     GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )
  res.json({ code: 0, data: { list, total: Number(total.total), page } })
})

router.get('/cases/:id', async (req, res) => {
  const item = await one(
    `SELECT s.id, s.prompt, s.platform, s.model, s.category, s.status, s.ai_answer AS aiAnswer,
            s.share_link AS shareLink, s.satisfaction, s.is_good_case AS isGoodCase, s.note,
            s.tags, s.images, s.source_message_id AS sourceMessageId,
            s.source_diary_id AS sourceDiaryId, s.rejection_reason AS rejectionReason,
            s.revision_of_id AS revisionOfId, s.revision_number AS revisionNumber,
            s.created_at AS createdAt,
            u.student_id AS studentId, u.name,
            COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'id', a.id, 'selectedText', a.selected_text, 'startOffset', a.start_offset,
              'endOffset', a.end_offset, 'prefixText', a.prefix_text, 'suffixText', a.suffix_text,
              'issueType', a.issue_type, 'comment', a.comment, 'source', a.source,
              'confidence', a.confidence, 'author', COALESCE(au.name, u.name),
              'agreeCount', a.agree_count, 'disagreeCount', a.disagree_count,
              'commentCount', a.comment_count, 'status', a.status,
              'withdrawnAt', a.withdrawn_at, 'withdrawnBy', wu.name
            )) FROM case_annotations a LEFT JOIN users au ON au.id = a.user_id
                LEFT JOIN users wu ON wu.id = a.withdrawn_by_user_id
                WHERE a.submission_id = s.id), JSON_ARRAY()) AS annotations
     FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [req.params.id]
  )
  if (!item) return res.status(404).json({ message: '案例不存在' })
  await writeAudit(req.user.id, 'case.view', 'submission', req.params.id)
  res.json({ code: 0, data: {
    ...item,
    isGoodCase: toBoolean(item.isGoodCase),
    tags: parseJson(item.tags, []),
    images: parseJson(item.images, []),
    annotations: parseJson(item.annotations, []),
  } })
})

router.put('/cases/:id/status', async (req, res) => {
  const parsed = z.object({
    status: z.enum(['submitted', 'published', 'rejected']),
    rejectionReason: z.string().trim().max(4000).optional().default(''),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '案例状态无效' })
  const reviewError = caseReviewError(parsed.data.status, parsed.data.rejectionReason)
  if (reviewError) return res.status(400).json({ message: reviewError })
  if (parsed.data.status === 'published') {
    const version = await one(
      'SELECT EXISTS(SELECT 1 FROM submissions child WHERE child.revision_of_id = ?) AS hasNewerRevision',
      [req.params.id]
    )
    if (!canPublishSubmissionVersion(version?.hasNewerRevision)) {
      return res.status(409).json({ message: '该案例已有后续版本，不能发布旧版本' })
    }
  }
  const result = await query(
    'UPDATE submissions SET status = ?, rejection_reason = ? WHERE id = ?',
    [parsed.data.status, parsed.data.status === 'rejected' ? parsed.data.rejectionReason : '', req.params.id]
  )
  if (!result.affectedRows) return res.status(404).json({ message: '案例不存在' })
  await writeAudit(req.user.id, 'case.status', 'submission', req.params.id, parsed.data)
  res.json({ code: 0, data: null })
})

router.get('/diaries', async (req, res) => {
  const { page, pageSize, offset } = pagination(req)
  const params = []
  let condition = 'WHERE 1=1'
  if (req.query.date) { condition += ' AND d.log_date = ?'; params.push(req.query.date) }
  if (req.query.keyword) {
    condition += ' AND (u.student_id LIKE ? OR u.name LIKE ? OR d.need_description LIKE ?)'
    const value = `%${req.query.keyword}%`
    params.push(value, value, value)
  }
  const total = await one(`SELECT COUNT(1) AS total FROM information_need_logs d JOIN users u ON u.id = d.user_id ${condition}`, params)
  const list = await query(
    `SELECT d.id, DATE_FORMAT(d.log_date, '%Y-%m-%d') AS logDate,
            d.need_description AS needDescription, d.channels, d.outcome,
            d.is_genai_related AS isGenaiRelated, d.genai_platform AS genaiPlatform,
            d.status, u.student_id AS studentId, u.name
     FROM information_need_logs d JOIN users u ON u.id = d.user_id ${condition}
     ORDER BY d.log_date DESC, d.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )
  res.json({ code: 0, data: { list: list.map(item => ({ ...item, isGenaiRelated: toBoolean(item.isGenaiRelated) })), total: Number(total.total), page } })
})

router.get('/diaries/completion', async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date : new Date().toISOString().slice(0, 10)
  const list = await query(
    `SELECT u.id, u.student_id AS studentId, u.name, u.class_name AS className,
            COUNT(d.id) AS submittedCount
     FROM users u
     LEFT JOIN information_need_logs d ON d.user_id = u.id AND d.log_date = ? AND d.status = 'submitted'
     WHERE u.role = 'student' AND u.status = 'active'
     GROUP BY u.id ORDER BY submittedCount ASC, u.class_name, u.student_id`,
    [date]
  )
  const requiredCount = 3
  res.json({ code: 0, data: {
    date,
    requiredCount,
    list: list.map(item => ({ ...item, submittedCount: Number(item.submittedCount), complete: Number(item.submittedCount) >= requiredCount })),
  } })
})

router.get('/diaries/:id', async (req, res) => {
  const item = await one(
    `SELECT d.id, DATE_FORMAT(d.log_date, '%Y-%m-%d') AS logDate,
            TIME_FORMAT(d.occurred_at, '%H:%i') AS occurredAt, d.context_text AS contextText,
            d.need_description AS needDescription, d.channels, d.search_process AS searchProcess,
            d.outcome, d.reflection, d.is_genai_related AS isGenaiRelated,
            d.genai_platform AS genaiPlatform, d.status, d.linked_conversation_id AS linkedConversationId,
            d.created_at AS createdAt, d.updated_at AS updatedAt,
            u.student_id AS studentId, u.name, u.class_name AS className
     FROM information_need_logs d JOIN users u ON u.id = d.user_id WHERE d.id = ?`,
    [req.params.id]
  )
  if (!item) return res.status(404).json({ message: '信息需求记录不存在' })
  await writeAudit(req.user.id, 'diary.view', 'information_need_log', req.params.id)
  res.json({ code: 0, data: { ...item, isGenaiRelated: toBoolean(item.isGenaiRelated) } })
})

router.get('/export', async (req, res) => {
  const type = ['users', 'conversations', 'cases', 'annotations', 'diaries'].includes(req.query.type) ? req.query.type : 'users'
  const queries = {
    users: `SELECT student_id AS 账号, name AS 姓名, role AS 角色, status AS 状态, class_name AS 班级,
                   last_login_at AS 最后登录时间, created_at AS 创建时间 FROM users ORDER BY class_name, student_id`,
    conversations: `SELECT u.student_id AS 账号, u.name AS 姓名, c.id AS 会话ID, c.title AS 标题,
                           m.role AS 消息角色, m.content AS 消息内容, m.provider AS 提供商,
                           m.model AS 模型, m.created_at AS 消息时间
                    FROM conversations c JOIN users u ON u.id = c.user_id
                    JOIN messages m ON m.conversation_id = c.id ORDER BY c.created_at, m.created_at`,
    cases: `SELECT u.student_id AS 账号, u.name AS 姓名, s.id AS 案例ID, s.prompt AS 信息需求,
                   s.ai_answer AS AI回答, s.platform AS 平台, s.model AS 模型, s.category AS 分类,
                   s.note AS 整体说明, s.status AS 状态, s.rejection_reason AS 退回原因,
                   s.revision_number AS 版本号, s.revision_of_id AS 上一版本ID, s.created_at AS 提交时间
            FROM submissions s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC`,
    annotations: `SELECT COALESCE(au.student_id, u.student_id) AS 批注者账号,
                         COALESCE(au.name, u.name) AS 批注者姓名, a.submission_id AS 案例ID,
                         a.selected_text AS 标注原文, a.issue_type AS 问题类型, a.comment AS 批注,
                         a.source AS 来源, a.confidence AS 置信度, a.agree_count AS 赞成票,
                         a.disagree_count AS 反对票,
                         a.comment_count AS 评论数, a.status AS 批注状态,
                         a.withdrawn_at AS 撤回时间, wu.student_id AS 撤回操作人账号,
                         a.created_at AS 创建时间
                  FROM case_annotations a JOIN submissions s ON s.id = a.submission_id
                  JOIN users u ON u.id = s.user_id LEFT JOIN users au ON au.id = a.user_id
                  LEFT JOIN users wu ON wu.id = a.withdrawn_by_user_id
                  ORDER BY a.created_at DESC`,
    diaries: `SELECT u.student_id AS 账号, u.name AS 姓名, d.log_date AS 日期, d.occurred_at AS 时间,
                     d.context_text AS 情境, d.need_description AS 信息需求, d.channels AS 渠道,
                     d.search_process AS 搜寻过程, d.outcome AS 结果, d.reflection AS 反思,
                     d.is_genai_related AS 是否GenAI, d.genai_platform AS GenAI平台, d.status AS 状态
              FROM information_need_logs d JOIN users u ON u.id = d.user_id ORDER BY d.log_date DESC`,
  }
  const rows = await query(queries[type])
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(type)
  if (rows.length) {
    sheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key, width: Math.min(50, Math.max(12, key.length * 2 + 4)) }))
    sheet.addRows(rows)
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(sheet.columnCount).letter}1` }
  }
  await writeAudit(req.user.id, 'data.export', type, '', { count: rows.length })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.xlsx"`)
  await workbook.xlsx.write(res)
  res.end()
})

router.get('/audit-logs', async (req, res) => {
  const list = await query(
    `SELECT a.id, a.action, a.target_type AS targetType, a.target_id AS targetId,
            a.detail, a.created_at AS createdAt, u.name AS actor
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
     ORDER BY a.created_at DESC LIMIT 200`
  )
  res.json({ code: 0, data: list.map(item => ({ ...item, detail: parseJson(item.detail, null) })) })
})

export default router
