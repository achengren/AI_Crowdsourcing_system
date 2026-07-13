import fs from 'node:fs'
import path from 'node:path'
import { UPLOADS_DIR } from '../config.js'

export function parseImageContent(raw) {
  const m = raw.match(/^\[image:(.+?)\]\n/)
  if (m) {
    return { imageUrl: m[1], text: raw.slice(m[0].length) }
  }
  return { imageUrl: null, text: raw }
}

export function readImageAsBase64(imageUrl) {
  const filePath = path.join(UPLOADS_DIR, path.basename(imageUrl))
  const buffer = fs.readFileSync(filePath)
  const base64 = buffer.toString('base64')
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const mime = ext === 'jpg' ? 'jpeg' : ext
  return `data:image/${mime};base64,${base64}`
}

export function parseTags(raw) {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}
