import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('case and diary records keep independent source links', async () => {
  const migration = await fs.readFile(new URL('../server/migrations/012_independent_diary_sources.sql', import.meta.url), 'utf8')
  const lookupMigration = await fs.readFile(new URL('../server/migrations/013_diary_case_lookup.sql', import.meta.url), 'utf8')
  const route = await fs.readFile(new URL('../server/routes/diaries.route.js', import.meta.url), 'utf8')
  const submissions = await fs.readFile(new URL('../server/routes/submissions.route.js', import.meta.url), 'utf8')

  assert.match(migration, /source_message_id CHAR\(32\)/)
  assert.match(migration, /source_submission_id CHAR\(32\)/)
  assert.match(route, /\/draft\/from-message\/:messageId/)
  assert.match(route, /\/draft\/from-case\/:caseId/)
  assert.match(route, /source_message_id, source_submission_id, status/)
  assert.match(route, /AS linkedSubmissionId/)
  assert.match(route, /AS hasLinkedSubmission/)
  assert.match(lookupMigration, /idx_submissions_source_diary/)
  assert.match(submissions, /FOR UPDATE/)
  assert.match(submissions, /DIARY_ALREADY_LINKED/)
})

test('chat exposes separate case and diary actions', async () => {
  const page = await fs.readFile(new URL('../src/pages/Chat/ChatPage.vue', import.meta.url), 'utf8')

  assert.match(page, /提交为案例/)
  assert.match(page, /记录为信息需求/)
  assert.match(page, /path: '\/cases\/new'/)
  assert.match(page, /path: '\/diaries\/new'/)
})

test('successful submissions offer an explicit cross-workflow choice', async () => {
  const caseEditor = await fs.readFile(new URL('../src/pages/Cases/CaseEditorPage.vue', import.meta.url), 'utf8')
  const diaryEditor = await fs.readFile(new URL('../src/pages/Diaries/DiaryEditorPage.vue', import.meta.url), 'utf8')

  assert.match(caseEditor, /是否同时提交为信息需求作业/)
  assert.match(caseEditor, /query: \{ caseId: response\.data\.id \}/)
  assert.match(caseEditor, /if \(form\.sourceDiaryId\)/)
  assert.doesNotMatch(caseEditor, /form\.sourceDiaryId \|\| form\.revisionOfId/)
  assert.doesNotMatch(caseEditor, /label="用户的信息需求"/)
  assert.match(diaryEditor, /是否同时提交为案例/)
  assert.match(diaryEditor, /query: \{ diaryId \}/)
  assert.match(diaryEditor, /saveRecord\('draft'\)/)
  assert.match(diaryEditor, /saveRecord\('submitted'\)/)
  assert.match(diaryEditor, /originalStatus\.value !== 'submitted'/)
  assert.match(diaryEditor, /updateDiary\(editingId\.value/)
})

test('diary management keeps overview, details and same-day editing in separate pages', async () => {
  const profilePage = await fs.readFile(new URL('../src/pages/Profile/ProfilePage.vue', import.meta.url), 'utf8')
  const diaryList = await fs.readFile(new URL('../src/pages/Diaries/DiaryListPage.vue', import.meta.url), 'utf8')
  const diaryRoute = await fs.readFile(new URL('../server/routes/diaries.route.js', import.meta.url), 'utf8')
  const router = await fs.readFile(new URL('../src/router/index.js', import.meta.url), 'utf8')

  assert.match(profilePage, /item\.logDate === today/)
  assert.match(profilePage, /item\.status === 'submitted'/)
  assert.match(profilePage, /onActivated\(loadOverview\)/)
  assert.match(profilePage, /router\.push\('\/diaries'\)/)
  assert.match(profilePage, /query: \{ mine: '1' \}/)
  assert.doesNotMatch(profilePage, /<a-table/)
  assert.doesNotMatch(profilePage, /caseVisible/)
  assert.doesNotMatch(profilePage, /selectedCase/)

  assert.match(diaryList, /今日已提交 \{\{ todaySubmitted \}\}\/3 条/)
  assert.match(diaryList, /v-if="record\.editable"/)
  assert.match(diaryList, /历史只读/)
  assert.match(diaryList, /onActivated\(loadDiaries\)/)
  assert.match(diaryList, /`\/diaries\/\$\{record\.id\}\/edit`/)
  assert.match(router, /path: '\/diaries'/)
  assert.match(router, /path: '\/diaries\/:id\/edit'/)

  assert.match(diaryRoute, /SUM\(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END\)/)
  assert.match(diaryRoute, /\(log_date = CURRENT_DATE\(\)\) AS editable/)
  assert.match(diaryRoute, /历史信息需求记录仅供查看，只能修改当天记录/)
})

test('case editor keeps the original conversation in a fixed scroll region', async () => {
  const caseEditor = await fs.readFile(new URL('../src/pages/Cases/CaseEditorPage.vue', import.meta.url), 'utf8')

  assert.match(caseEditor, /height: clamp\(520px, calc\(100vh - 112px\), 760px\)/)
  assert.match(caseEditor, /\.context-list, \.source-preview \{[^}]*overflow-y: auto/s)
  assert.match(caseEditor, /overscroll-behavior: contain/)
})

test('database export includes teaching workflow and upload metadata', async () => {
  const exporter = await fs.readFile(new URL('../scripts/export-mysql-data.js', import.meta.url), 'utf8')

  assert.match(exporter, /'message_ratings'/)
  assert.match(exporter, /'case_drafts'/)
  assert.match(exporter, /'uploaded_files'/)
  assert.match(exporter, /SET FOREIGN_KEY_CHECKS=0/)
})
