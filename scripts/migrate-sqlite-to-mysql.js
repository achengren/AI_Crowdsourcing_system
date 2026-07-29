import fs from 'node:fs'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { initDb, transaction, closeDb, genId } from '../server/db.js'

const sourcePath = path.resolve(process.argv[2] || 'server/data.db')
if (!fs.existsSync(sourcePath)) throw new Error(`找不到旧数据库: ${sourcePath}`)

function selectAll(db, sql) {
  const result = db.exec(sql)[0]
  if (!result) return []
  return result.values.map(values => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])))
}

await initDb()
const SQL = await initSqlJs()
const source = new SQL.Database(fs.readFileSync(sourcePath))
const users = selectAll(source, 'SELECT * FROM users')
const conversations = selectAll(source, 'SELECT * FROM conversations')
const messages = selectAll(source, 'SELECT * FROM messages')
const submissions = selectAll(source, 'SELECT * FROM submissions')
const likes = selectAll(source, 'SELECT * FROM likes')
const comments = selectAll(source, 'SELECT * FROM comments')

await transaction(async connection => {
  for (const item of users) {
    await connection.execute(
      `INSERT INTO users (id, student_id, name, password_hash, role, status, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', 0, COALESCE(?, CURRENT_TIMESTAMP(3)))
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role)`,
      [item.id, item.student_id, item.name, item.password_hash || '', item.role === 'admin' ? 'admin' : 'student', item.created_at]
    )
  }
  for (const item of conversations) {
    await connection.execute(
      `INSERT IGNORE INTO conversations (id, user_id, title, created_at, updated_at)
       VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP(3)), COALESCE(?, CURRENT_TIMESTAMP(3)))`,
      [item.id, item.user_id, item.title || '历史对话', item.created_at, item.created_at]
    )
  }
  for (const item of messages) {
    await connection.execute(
      `INSERT IGNORE INTO messages
       (id, conversation_id, role, content, quality_flag, provider, model, modality, thinking_enabled, created_at)
       VALUES (?, ?, ?, ?, ?, 'legacy', 'unknown', 'text', 0, COALESCE(?, CURRENT_TIMESTAMP(3)))`,
      [item.id, item.conversation_id, item.role === 'assistant' ? 'assistant' : 'user', item.content,
        item.quality_flag || null, item.created_at]
    )
  }
  for (const item of submissions) {
    await connection.execute(
      `INSERT IGNORE INTO submissions
       (id, user_id, prompt, platform, model, ai_answer, category, share_link, satisfaction,
        is_good_case, note, tags, images, status, like_count, comment_count, created_at)
       VALUES (?, ?, ?, ?, 'unknown', ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, COALESCE(?, CURRENT_TIMESTAMP(3)))`,
      [item.id, item.user_id, item.prompt, item.platform, item.ai_answer || '', item.category,
        item.share_link || '', item.satisfaction || 0, item.is_good_case || 0, item.note || '',
        item.tags || '[]', item.images || '[]', item.like_count || 0, item.comment_count || 0, item.created_at]
    )
  }
  const userIds = new Set(users.map(item => item.id))
  for (const item of likes) {
    if (userIds.has(item.user_id)) {
      await connection.execute('INSERT IGNORE INTO likes (case_id, user_id) VALUES (?, ?)', [item.case_id, item.user_id])
    }
  }
  for (const item of comments) {
    const author = users.find(user => user.name === item.author)
    const submission = submissions.find(entry => entry.id === item.case_id)
    const userId = author?.id || submission?.user_id
    if (userId) {
      await connection.execute(
        'INSERT IGNORE INTO comments (id, case_id, user_id, content, created_at) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP(3)))',
        [item.id || genId(), item.case_id, userId, item.content, item.created_at]
      )
    }
  }
})

console.log(JSON.stringify({ imported: {
  users: users.length,
  conversations: conversations.length,
  messages: messages.length,
  submissions: submissions.length,
  likes: likes.length,
  comments: comments.length,
} }, null, 2))
await closeDb()
