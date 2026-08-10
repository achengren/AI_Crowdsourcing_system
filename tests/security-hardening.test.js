import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { clearAuthCookie, setAuthCookie } from '../server/middleware.js'

test('auth cookie is HttpOnly and can be cleared with matching options', () => {
  const calls = []
  const response = {
    cookie(name, value, options) { calls.push({ method: 'set', name, value, options }) },
    clearCookie(name, options) { calls.push({ method: 'clear', name, options }) },
  }

  setAuthCookie(response, 'signed-token')
  clearAuthCookie(response)

  assert.equal(calls[0].options.httpOnly, true)
  assert.equal(calls[0].options.sameSite, 'strict')
  assert.equal(calls[0].options.path, '/')
  assert.deepEqual(calls[1].options, {
    httpOnly: calls[0].options.httpOnly,
    secure: calls[0].options.secure,
    sameSite: calls[0].options.sameSite,
    path: calls[0].options.path,
  })
})

test('uploaded images are authenticated and S3 reads use the storage service', async () => {
  const index = await fs.readFile(new URL('../server/index.js', import.meta.url), 'utf8')
  const storage = await fs.readFile(new URL('../server/services/storage.js', import.meta.url), 'utf8')
  const image = await fs.readFile(new URL('../server/utils/image.js', import.meta.url), 'utf8')

  assert.match(index, /app\.get\('\/uploads\/:filename', authMiddleware, serveUpload\)/)
  assert.doesNotMatch(index, /express\.static\(UPLOADS_DIR/)
  assert.match(storage, /GetObjectCommand/)
  assert.match(storage, /export async function downloadStoredObject/)
  assert.match(image, /await downloadStoredObject\(imageUrl\)/)
  assert.doesNotMatch(image, /default: storage|storage\.download/)
})

test('new-chat responses are discarded after the conversation context changes', async () => {
  const page = await fs.readFile(new URL('../src/pages/Chat/ChatPage.vue', import.meta.url), 'utf8')

  assert.match(page, /let conversationGeneration = 0/)
  assert.match(page, /const targetGeneration = conversationGeneration/)
  assert.match(page, /targetGeneration !== conversationGeneration/)
  assert.doesNotMatch(page, /targetConvId !== null/)
})
