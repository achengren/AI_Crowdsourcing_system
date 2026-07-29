import { genId, query } from './db.js'

export async function writeAudit(actorUserId, action, targetType, targetId = '', detail = null) {
  await query(
    'INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)',
    [genId(), actorUserId || null, action, targetType, targetId, detail ? JSON.stringify(detail) : null]
  )
}
