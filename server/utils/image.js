import path from 'node:path'
import { downloadStoredObject } from '../services/storage.js'

export function parseImageContent(raw) {
  const m = raw.match(/^\[image:(.+?)\]\n/)
  if (m) {
    return { imageUrl: m[1], text: raw.slice(m[0].length) }
  }
  return { imageUrl: null, text: raw }
}

export async function readImageAsBase64(imageUrl) {
  const buffer = await downloadStoredObject(imageUrl)
  const base64 = buffer.toString('base64')
  const ext = path.extname(new URL(imageUrl, 'http://local').pathname).slice(1).toLowerCase()
  const mime = ext === 'jpg' ? 'jpeg' : ext
  return `data:image/${mime};base64,${base64}`
}

export function parseTags(raw) {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}
