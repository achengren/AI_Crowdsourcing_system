import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('diary editor locks the course date and prevents future occurrence times', async () => {
  const editor = await fs.readFile(new URL('../src/pages/Diaries/DiaryEditorPage.vue', import.meta.url), 'utf8')
  const route = await fs.readFile(new URL('../server/routes/diaries.route.js', import.meta.url), 'utf8')

  assert.doesNotMatch(editor, /<a-date-picker/)
  assert.match(editor, /记录日期由系统锁定为今天/)
  assert.match(editor, /:disabled-time="disabledOccurredTime"/)
  assert.match(editor, /timeZone: 'Asia\/Shanghai'/)
  assert.match(editor, /发生时间不能晚于当前时间/)
  assert.match(route, /validateDiaryTiming\(data, now\)/)
  assert.match(route, /仅支持将当天的 AI 对话记录为信息需求作业/)
  assert.match(route, /sources\.sourceLogDates\.some/)
})

test('new conversations store a validated topic title before responding', async () => {
  const chatRoute = await fs.readFile(new URL('../server/routes/chat.route.js', import.meta.url), 'utf8')
  const chatService = await fs.readFile(new URL('../server/services/chatService.js', import.meta.url), 'utf8')
  const conversationRoute = await fs.readFile(new URL('../server/routes/conversations.route.js', import.meta.url), 'utf8')
  const migration = await fs.readFile(new URL('../server/migrations/014_repair_generated_conversation_titles.sql', import.meta.url), 'utf8')

  assert.match(chatRoute, /await generateTitle\(prompt, result\.content\)/)
  assert.match(chatRoute, /\[convId, req\.user\.id, conversationTitle\]/)
  assert.doesNotMatch(chatRoute, /generateTitle\(prompt\)\.then/)
  assert.match(chatService, /thinking: \{ type: 'disabled' \}/)
  assert.match(chatService, /sanitizeConversationTitle/)
  assert.match(conversationRoute, /title_manually_edited = 1/)
  assert.match(migration, /title_manually_edited = 0/)
  assert.match(migration, /标题生成器/)
})
