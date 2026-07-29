import { Router } from 'express'
import { z } from 'zod'
import { genId, one, query } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { toBoolean } from '../utils/data.js'

const router = Router()
router.use(authMiddleware)

const diarySchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  occurredAt: z.string().nullable().optional(),
  contextText: z.string().trim().min(1),
  needDescription: z.string().trim().min(1),
  channels: z.string().trim().min(1),
  searchProcess: z.string().trim().min(1),
  outcome: z.string().trim().min(1),
  reflection: z.string().trim().min(1),
  isGenaiRelated: z.boolean().optional().default(false),
  genaiPlatform: z.string().optional().default(''),
  linkedConversationId: z.string().nullable().optional(),
  status: z.enum(['draft', 'submitted']).optional().default('draft'),
})

function mapDiary(row) {
  return { ...row, isGenaiRelated: toBoolean(row.isGenaiRelated) }
}

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
            linked_conversation_id AS linkedConversationId, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM information_need_logs ${condition} ORDER BY log_date DESC, occurred_at DESC, created_at DESC`,
    params
  )
  const progress = await query(
    `SELECT DATE_FORMAT(log_date, '%Y-%m-%d') AS logDate,
            COUNT(1) AS total, SUM(status = 'submitted') AS submitted
     FROM information_need_logs WHERE user_id = ? AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
     GROUP BY log_date ORDER BY log_date DESC`,
    [req.user.id]
  )
  res.json({ code: 0, data: { list: list.map(mapDiary), progress } })
})

router.post('/', async (req, res) => {
  const parsed = diarySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '请完整填写信息需求及获取过程' })
  const data = parsed.data
  if (data.isGenaiRelated && !data.genaiPlatform.trim()) return res.status(400).json({ message: '请选择使用的 GenAI 平台' })
  const id = genId()
  await query(
    `INSERT INTO information_need_logs
     (id, user_id, log_date, occurred_at, context_text, need_description, channels,
      search_process, outcome, reflection, is_genai_related, genai_platform,
      linked_conversation_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.user.id, data.logDate, data.occurredAt || null, data.contextText,
      data.needDescription, data.channels, data.searchProcess, data.outcome, data.reflection,
      data.isGenaiRelated ? 1 : 0, data.isGenaiRelated ? data.genaiPlatform : '',
      data.linkedConversationId || null, data.status]
  )
  res.json({ code: 0, data: { id } })
})

router.put('/:id', async (req, res) => {
  const parsed = diarySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: '请完整填写信息需求及获取过程' })
  const existing = await one('SELECT id FROM information_need_logs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  if (!existing) return res.status(404).json({ message: '记录不存在' })
  const data = parsed.data
  await query(
    `UPDATE information_need_logs SET log_date = ?, occurred_at = ?, context_text = ?,
     need_description = ?, channels = ?, search_process = ?, outcome = ?, reflection = ?,
     is_genai_related = ?, genai_platform = ?, linked_conversation_id = ?, status = ? WHERE id = ?`,
    [data.logDate, data.occurredAt || null, data.contextText, data.needDescription,
      data.channels, data.searchProcess, data.outcome, data.reflection,
      data.isGenaiRelated ? 1 : 0, data.isGenaiRelated ? data.genaiPlatform : '',
      data.linkedConversationId || null, data.status, req.params.id]
  )
  res.json({ code: 0, data: null })
})

router.delete('/:id', async (req, res) => {
  const result = await query('DELETE FROM information_need_logs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  if (!result.affectedRows) return res.status(404).json({ message: '记录不存在' })
  res.json({ code: 0, data: null })
})

export default router
