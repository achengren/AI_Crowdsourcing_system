import fs from 'node:fs'
import crypto from 'node:crypto'
import initSqlJs from 'sql.js'
import { DB_PATH } from './config.js'

let db

let saveTimer = null

export function getDb() {
  return db
}

export function saveDb() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFile(DB_PATH, Buffer.from(db.export()), (err) => {
      if (err) console.error('数据库保存失败:', err)
    })
  }, 200)
}

export function saveDbNow() {
  clearTimeout(saveTimer)
  try {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
  } catch (err) {
    console.error('数据库同步保存失败:', err)
  }
}

export function genId() {
  return crypto.randomBytes(16).toString('hex')
}

export function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

export async function initDb() {
  const SQL = await initSqlJs()

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buffer)
    try { db.run("ALTER TABLE users ADD COLUMN password_hash TEXT") } catch {}
    try { db.run("ALTER TABLE submissions ADD COLUMN images TEXT DEFAULT '[]'") } catch {}
    try { db.run("CREATE TABLE conversations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT DEFAULT '新对话', created_at TEXT DEFAULT (datetime('now')))") } catch {}
    try { db.run("CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))") } catch {}
    return
  }

  db = new SQL.Database()

  db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author TEXT,
      prompt TEXT NOT NULL,
      platform TEXT NOT NULL,
      category TEXT NOT NULL,
      ai_answer TEXT DEFAULT '',
      share_link TEXT DEFAULT '',
      satisfaction INTEGER DEFAULT 0,
      is_good_case INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE likes (
      case_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (case_id, user_id)
    )
  `)

  db.run(`
    CREATE TABLE comments (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      author TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES submissions(id)
    )
  `)

  db.run(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT '新对话',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
  `)

  saveDb()
}
