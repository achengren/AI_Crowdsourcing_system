import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('submission insert publishes immediately and supplies classification fields', async () => {
  const routeSource = await fs.readFile(new URL('../server/routes/submissions.route.js', import.meta.url), 'utf8')
  const insertStatement = routeSource.match(/`INSERT INTO submissions[\s\S]*?`,/)?.[0] || ''

  assert.match(insertStatement, /error_type,\s*error_types,\s*error_type_other/)
  assert.match(insertStatement, /knowledge_scenarios,\s*knowledge_scenario_other/)
  assert.match(insertStatement, /source_issue,\s*source_issues,\s*source_issue_other/)
  assert.match(insertStatement, /status,\s*published_at,\s*rejection_reason/)
  assert.match(insertStatement, /'published',\s*\n\s*CURRENT_TIMESTAMP\(3\)/)
})

test('multi-value taxonomy migration preserves legacy classifications', async () => {
  const migration = await fs.readFile(new URL('../server/migrations/009_multi_value_case_taxonomy.sql', import.meta.url), 'utf8')
  assert.match(migration, /ADD COLUMN error_types JSON/)
  assert.match(migration, /ADD COLUMN source_issues JSON/)
  assert.match(migration, /ADD COLUMN error_type_other VARCHAR\(200\)/)
  assert.match(migration, /JSON_ARRAY\(error_type\)/)
  assert.match(migration, /JSON_ARRAY\(source_issue\)/)
})

test('annotation comments support reply threads and non-destructive parent deletion', async () => {
  const migration = await fs.readFile(new URL('../server/migrations/010_annotation_comment_threads.sql', import.meta.url), 'utf8')
  const route = await fs.readFile(new URL('../server/routes/cases.route.js', import.meta.url), 'utf8')

  assert.match(migration, /ADD COLUMN parent_comment_id CHAR\(32\)/)
  assert.match(migration, /ADD COLUMN root_comment_id CHAR\(32\)/)
  assert.match(migration, /ADD COLUMN deleted_at DATETIME\(3\)/)
  assert.match(route, /parentCommentId/)
  assert.match(route, /rootCommentId/)
  assert.match(route, /parent_comment_id = \? OR root_comment_id = \?/)
  assert.match(route, /SET content = '', deleted_at = CURRENT_TIMESTAMP\(3\)/)
})

test('feedback migration keeps ratings separate from case submissions', async () => {
  const migration = await fs.readFile(new URL('../server/migrations/008_case_publishing_and_feedback.sql', import.meta.url), 'utf8')
  assert.match(migration, /CREATE TABLE message_ratings/)
  assert.match(migration, /CREATE TABLE case_drafts/)
  assert.match(migration, /'withdrawn'/)
})
