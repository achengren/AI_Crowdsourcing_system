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
  const stored = await storeUpload({
    originalname: 'pixel.png',
    mimetype: 'image/png',
    buffer: Buffer.from('storage-test'),
  })
  assert.match(stored.url, /^\/uploads\/[a-f0-9]{32}\.png$/)
  const filename = path.basename(stored.url)
  assert.equal(await fs.readFile(path.join(UPLOADS_DIR, filename), 'utf8'), 'storage-test')
  assert.equal((await downloadStoredObject(stored.url)).toString(), 'storage-test')
  assert.equal(storedObjectContentType(stored.url), 'image/png')
  await deleteStoredObject(stored.url)
  await assert.rejects(fs.access(path.join(UPLOADS_DIR, filename)))
})
