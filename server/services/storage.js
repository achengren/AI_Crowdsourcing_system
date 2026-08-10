import fs from 'node:fs/promises'
import path from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ALLOWED_MIME_TYPES, STORAGE_CONFIG, UPLOADS_DIR } from '../config.js'
import { genId } from '../db.js'

let s3Client

function extensionFor(file) {
  const original = path.extname(file.originalname || '').toLowerCase()
  if (/^\.[a-z0-9]{1,8}$/.test(original)) return original
  return ({
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
  })[file.mimetype] || '.bin'
}

function createS3Client() {
  const { s3 } = STORAGE_CONFIG
  if (!s3.bucket || !s3.accessKeyId || !s3.secretAccessKey || !s3.publicBaseUrl) {
    throw new Error('S3 存储缺少 bucket、访问密钥或公开访问地址配置')
  }
  return new S3Client({
    region: s3.region,
    endpoint: s3.endpoint,
    forcePathStyle: s3.forcePathStyle,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  })
}

export async function initStorage() {
  if (!['local', 's3'].includes(STORAGE_CONFIG.driver)) {
    throw new Error(`不支持的 STORAGE_DRIVER: ${STORAGE_CONFIG.driver}`)
  }
  if (STORAGE_CONFIG.driver === 'local') {
    await fs.mkdir(UPLOADS_DIR, { recursive: true })
  } else {
    s3Client = createS3Client()
  }
}

export async function storeUpload(file) {
  if (!file?.buffer || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error('上传文件类型无效')
  }
  const filename = `${genId()}${extensionFor(file)}`
  if (STORAGE_CONFIG.driver === 'local') {
    await fs.writeFile(path.join(UPLOADS_DIR, filename), file.buffer, { flag: 'wx' })
    return { key: filename, url: `/uploads/${filename}` }
  }

  const key = `${STORAGE_CONFIG.s3.keyPrefix}/${filename}`
  await s3Client.send(new PutObjectCommand({
    Bucket: STORAGE_CONFIG.s3.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    CacheControl: 'public, max-age=604800',
  }))
  return { key, url: `${STORAGE_CONFIG.s3.publicBaseUrl}/${key}` }
}

export async function deleteStoredObject(url) {
  if (!url) return
  if (STORAGE_CONFIG.driver === 'local') {
    if (!url.startsWith('/uploads/')) return
    const filename = path.basename(new URL(url, 'http://local').pathname)
    await fs.rm(path.join(UPLOADS_DIR, filename), { force: true })
    return
  }

  const prefix = `${STORAGE_CONFIG.s3.publicBaseUrl}/`
  if (!url.startsWith(prefix)) return
  const key = decodeURIComponent(url.slice(prefix.length))
  if (!key.startsWith(`${STORAGE_CONFIG.s3.keyPrefix}/`)) return
  await s3Client.send(new DeleteObjectCommand({ Bucket: STORAGE_CONFIG.s3.bucket, Key: key }))
}

export async function download(url) {
  if (!url) throw new Error('无效的文件 URL')
  if (STORAGE_CONFIG.driver === 'local') {
    if (!url.startsWith('/uploads/')) throw new Error('无效的本地文件 URL')
    const filename = path.basename(new URL(url, 'http://local').pathname)
    return await fs.readFile(path.join(UPLOADS_DIR, filename))
  }
  const prefix = `${STORAGE_CONFIG.s3.publicBaseUrl}/`
  if (!url.startsWith(prefix)) throw new Error('无效的 S3 文件 URL')
  const key = decodeURIComponent(url.slice(prefix.length))
  const response = await s3Client.send(new GetObjectCommand({ Bucket: STORAGE_CONFIG.s3.bucket, Key: key }))
  const chunks = []
  for await (const chunk of response.Body) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
