import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('case publishing validates before showing the irreversible confirmation', async () => {
  const page = await fs.readFile(new URL('../src/pages/Cases/CaseEditorPage.vue', import.meta.url), 'utf8')

  assert.match(page, /async function requestPublish\(\) \{\s*if \(!\(await validatePublishForm\(\)\)\) return\s*Modal\.confirm/s)
  assert.match(page, /@click="requestPublish"/)
  assert.doesNotMatch(page, /<a-popconfirm[\s\S]*@confirm="publishCase"/)
  assert.match(page, /已自动保存为草稿/)
})

test('message ratings expose a distinct label for every score', async () => {
  const page = await fs.readFile(new URL('../src/pages/Chat/ChatPage.vue', import.meta.url), 'utf8')

  assert.match(page, /role="radiogroup"/)
  assert.match(page, /type="radio"/)
  assert.match(page, /:aria-label="`\$\{score\} 星：\$\{RATING_LABELS\[score - 1\]\}`"/)
  assert.match(page, /RATING_LABELS = \['非常不满意', '不满意', '一般', '满意', '非常满意'\]/)
})

test('admin and gallery pages format timestamps and diary status for users', async () => {
  const admin = await fs.readFile(new URL('../src/pages/Admin/AdminPage.vue', import.meta.url), 'utf8')
  const gallery = await fs.readFile(new URL('../src/pages/Gallery/GalleryPage.vue', import.meta.url), 'utf8')

  assert.match(admin, /formatDateTime\(record\.lastLoginAt, '从未登录'\)/)
  assert.match(admin, /formatDateTime\(record\.updatedAt\)/)
  assert.match(admin, /diaryStatusLabel\(record\.status\)/)
  assert.match(admin, /parsed\.format\('YYYY-MM-DD HH:mm'\)/)
  assert.match(gallery, /formatDateTime\(detailCase\.createdAt\)/)
  assert.match(gallery, /parsed\.format\('YYYY-MM-DD HH:mm'\)/)
})
