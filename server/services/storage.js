import fs from 'node:fs/promises'
import path from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ALLOWED_MIME_TYPES, STORAGE_CONFIG, UPLOADS_DIR } from '../config.js'
import { genId } from '../db.js'

let s3Client

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

const EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

function detectedImageMimeType(buffer) {
  if (!Buffer.isBuffer(buffer)) return ''
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) {
    return 'image/gif'
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  return ''
}

function invalidImage(message) {
  const error = new Error(message)
  error.code = 'INVALID_IMAGE'
  return error
}

function createS3Client() {
  const { s3 } = STORAGE_CONFIG
  if (!s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
    throw new Error('S3 存储缺少 bucket 或访问密钥配置')
  }
  return new S3Client({
    region: s3.region,
    endpoint: s3.endpoint,
    forcePathStyle: s3.forcePathStyle,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  })
}

function storedFilename(url) {
  if (!url) return ''
  const pathname = new URL(url, 'http://local').pathname
  const filename = path.basename(pathname)
  return /^[a-f0-9]{32}\.(png|jpe?g|gif|webp)$/i.test(filename) ? filename : ''
}

function s3KeyForUrl(url) {
  const filename = storedFilename(url)
  if (!filename) return ''
  const publicPrefix = `${STORAGE_CONFIG.s3.publicBaseUrl}/`
  if (STORAGE_CONFIG.s3.publicBaseUrl && url.startsWith(publicPrefix)) {
    const key = decodeURIComponent(url.slice(publicPrefix.length))
    return key.startsWith(`${STORAGE_CONFIG.s3.keyPrefix}/`) ? key : ''
  }
  return `${STORAGE_CONFIG.s3.keyPrefix}/${filename}`
}

export function storedObjectContentType(url) {
  return MIME_TYPES[path.extname(storedFilename(url)).toLowerCase()] || 'application/octet-stream'
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
    throw invalidImage('上传文件类型无效')
  }
  const detectedMimeType = detectedImageMimeType(file.buffer)
  if (!detectedMimeType || detectedMimeType !== file.mimetype) {
    throw invalidImage('图片内容与文件类型不匹配')
  }
  const filename = `${genId()}${EXTENSIONS[detectedMimeType]}`
  if (STORAGE_CONFIG.driver === 'local') {
    await fs.writeFile(path.join(UPLOADS_DIR, filename), file.buffer, { flag: 'wx' })
    return { key: filename, url: `/uploads/${filename}` }
  }

  const key = `${STORAGE_CONFIG.s3.keyPrefix}/${filename}`
  await s3Client.send(new PutObjectCommand({
    Bucket: STORAGE_CONFIG.s3.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: detectedMimeType,
    CacheControl: 'private, max-age=3600',
  }))
  return { key, url: `/uploads/${filename}` }
}

export async function downloadStoredObject(url) {
  const filename = storedFilename(url)
  if (!filename) throw new Error('无效的图片路径')
  if (STORAGE_CONFIG.driver === 'local') {
    const pathname = new URL(url, 'http://local').pathname
    if (!pathname.startsWith('/uploads/')) throw new Error('无效的本地图片路径')
    return fs.readFile(path.join(UPLOADS_DIR, filename))
  }

  const key = s3KeyForUrl(url)
  if (!key) throw new Error('无效的 S3 图片路径')
  const response = await s3Client.send(new GetObjectCommand({ Bucket: STORAGE_CONFIG.s3.bucket, Key: key }))
  if (!response.Body) throw new Error('S3 图片内容为空')
  return Buffer.from(await response.Body.transformToByteArray())
}

export async function deleteStoredObject(url) {
  if (!url) return
  if (STORAGE_CONFIG.driver === 'local') {
    if (!url.startsWith('/uploads/')) return
    const filename = path.basename(new URL(url, 'http://local').pathname)
    await fs.rm(path.join(UPLOADS_DIR, filename), { force: true })
    return
  }

  const key = s3KeyForUrl(url)
  if (!key) return
  await s3Client.send(new DeleteObjectCommand({ Bucket: STORAGE_CONFIG.s3.bucket, Key: key }))
}

