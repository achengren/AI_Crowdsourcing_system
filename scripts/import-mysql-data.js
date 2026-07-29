import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { DB_CONFIG } from '../server/config.js'
import { closeDb, initDb } from '../server/db.js'

const inputPath = path.resolve(process.argv[2] || '.deployment/ai-crowdsourcing-data.sql')

await initDb()
await closeDb()

const sql = await fs.readFile(inputPath, 'utf8')
const connection = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true })

try {
  await connection.query(sql)
  const [rows] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM conversations) AS conversations,
      (SELECT COUNT(*) FROM messages) AS messages,
      (SELECT COUNT(*) FROM submissions) AS submissions
  `)
  console.log('Import complete:', rows[0])
} finally {
  await connection.end()
}
