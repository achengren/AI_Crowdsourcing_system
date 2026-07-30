import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('submission insert supplies every required workflow field', async () => {
  const routeSource = await fs.readFile(new URL('../server/routes/submissions.route.js', import.meta.url), 'utf8')
  const insertStatement = routeSource.match(/`INSERT INTO submissions[\s\S]*?`,/)?.[0] || ''

  assert.match(insertStatement, /status,\s*rejection_reason,\s*revision_of_id,\s*revision_number/)
  assert.match(insertStatement, /'submitted',\s*'',\s*\?,\s*\?\)/)
})
