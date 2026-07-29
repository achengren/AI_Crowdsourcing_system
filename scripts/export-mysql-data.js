import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { DB_CONFIG } from '../server/config.js'

const TABLES = [
  'users',
  'conversations',
  'messages',
  'information_need_logs',
  'submissions',
  'case_annotations',
  'likes',
  'comments',
  'annotation_likes',
  'annotation_comments',
  'audit_logs',
  'ai_vision_cache',
]

const outputPath = path.resolve(process.argv[2] || '.deployment/ai-crowdsourcing-data.sql')
const connection = await mysql.createConnection({ ...DB_CONFIG, dateStrings: true })

function serializeValue(value) {
  if (value === null || value === undefined) return 'NULL'
  if (Buffer.isBuffer(value)) return `FROM_BASE64(${connection.escape(value.toString('base64'))})`
  if (typeof value === 'object') return connection.escape(JSON.stringify(value))
  return connection.escape(value)
}

try {
  const statements = [
    '-- HIB course management data export',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS=0;',
  ]
  const counts = {}

  for (const table of [...TABLES].reverse()) {
    statements.push(`DELETE FROM \`${table}\`;`)
  }

  for (const table of TABLES) {
    const [rows, fields] = await connection.query(`SELECT * FROM \`${table}\``)
    counts[table] = rows.length
    if (!rows.length) continue

    const columns = fields.map(field => `\`${field.name}\``).join(', ')
    for (const row of rows) {
      const values = fields.map(field => serializeValue(row[field.name])).join(', ')
      statements.push(`INSERT INTO \`${table}\` (${columns}) VALUES (${values});`)
    }
  }

  statements.push('SET FOREIGN_KEY_CHECKS=1;', '')
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, statements.join('\n'), { encoding: 'utf8', mode: 0o600 })
  console.log(`Exported ${Object.values(counts).reduce((sum, count) => sum + count, 0)} rows to ${outputPath}`)
  console.table(counts)
} finally {
  await connection.end()
}
