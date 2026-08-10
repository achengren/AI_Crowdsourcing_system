import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { UPLOADS_DIR } from '../server/config.js'
import {
  deleteStoredObject,
  downloadStoredObject,
  initStorage,
  storedObjectContentType,
  storeUpload,
} from '../server/services/storage.js'

test('local storage writes and removes an uploaded image', async () => {
  await initStorage()
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const stored = await storeUpload({
    originalname: 'pixel.html',
    mimetype: 'image/png',
    buffer: png,
  })
  assert.match(stored.url, /^\/uploads\/[a-f0-9]{32}\.png$/)
  const filename = path.basename(stored.url)
  assert.deepEqual(await fs.readFile(path.join(UPLOADS_DIR, filename)), png)
  assert.deepEqual(await downloadStoredObject(stored.url), png)
  assert.equal(storedObjectContentType(stored.url), 'image/png')
  await deleteStoredObject(stored.url)
  await assert.rejects(fs.access(path.join(UPLOADS_DIR, filename)))
})

test('storage rejects content that only claims to be an image', async () => {
  await assert.rejects(
    storeUpload({
      originalname: 'payload.html',
      mimetype: 'image/png',
      buffer: Buffer.from('<script>alert(1)</script>'),
    }),
    error => error.code === 'INVALID_IMAGE' && error.message === '图片内容与文件类型不匹配'
  )
})
