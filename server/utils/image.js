import fs from 'node:fs/promises'
import path from 'node:path'
import { UPLOADS_DIR, STORAGE_CONFIG } from '../config.js'

export function parseImageContent(raw) {
  const m = raw.match(/^\[image:(.+?)\]\n/)
  if (m) {
    return { imageUrl: m[1], text: raw.slice(m[0].length) }
  }
  return { imageUrl: null, text: raw }
}

export async function readImageAsBase64(imageUrl) {
  let buffer
  if (STORAGE_CONFIG.driver === 'local') {
    buffer = await fs.readFile(path.join(UPLOADS_DIR, path.basename(imageUrl)))
  } else {
    const { default: storage } = await import('../services/storage.js')
    buffer = await storage.download(imageUrl)
  }
  const base64 = buffer.toString('base64')
  const ext = path.extname(imageUrl).slice(1).toLowerCase()
  const mime = ext === 'jpg' ? 'jpeg' : ext
  return `data:image/${mime};base64,${base64}`
}

export function parseTags(raw) {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}
