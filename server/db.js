import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { ADMIN_BOOTSTRAP, DB_CONFIG } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let pool

export function genId() {
  return crypto.randomBytes(16).toString('hex')
}

export function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday
}

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params)
  return rows
}

export async function one(sql, params = []) {
  const rows = await query(sql, params)
  return rows[0] || null
}

export async function transaction(work) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function runMigrations() {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  const migrationDir = path.join(__dirname, 'migrations')
  const files = (await fs.readdir(migrationDir)).filter(name => name.endsWith('.sql')).sort()
  const applied = new Set((await query('SELECT name FROM schema_migrations')).map(row => row.name))

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await fs.readFile(path.join(migrationDir, file), 'utf8')
    await transaction(async connection => {
      await connection.query(sql)
      await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file])
    })
    console.log(`数据库迁移完成: ${file}`)
  }
}

async function ensureBootstrapAdmin() {
  const existing = await one("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
  if (existing || !ADMIN_BOOTSTRAP.studentId || !ADMIN_BOOTSTRAP.password) return

  await query(
    `INSERT INTO users (id, student_id, name, password_hash, role, status, must_change_password)
     VALUES (?, ?, ?, ?, 'admin', 'active', 0)`,
    [genId(), ADMIN_BOOTSTRAP.studentId, ADMIN_BOOTSTRAP.name, bcrypt.hashSync(ADMIN_BOOTSTRAP.password, 12)]
  )
  console.log(`已创建初始管理员: ${ADMIN_BOOTSTRAP.studentId}`)
}

export async function initDb() {
  pool = mysql.createPool({
    ...DB_CONFIG,
    waitForConnections: true,
    queueLimit: 100,
    charset: 'utf8mb4',
    timezone: '+08:00',
    multipleStatements: true,
  })
  await query('SELECT 1')
  await runMigrations()
  await ensureBootstrapAdmin()
}

export async function closeDb() {
  if (pool) await pool.end()
}

// Compatibility no-ops while callers are migrated away from sql.js.
export function saveDb() {}
export async function saveDbNow() { await closeDb() }
