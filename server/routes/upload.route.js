import { Router } from 'express'
import { authMiddleware, upload } from '../middleware.js'
import { deleteStoredObject, downloadStoredObject, storedObjectContentType, storeUpload } from '../services/storage.js'
import { one, query } from '../db.js'

const router = Router()

router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请选择图片文件' })
  }
  const stored = await storeUpload(req.file)
  try {
    await query('INSERT INTO uploaded_files (file_path, user_id) VALUES (?, ?)', [stored.url, req.user.id])
  } catch (error) {
    await deleteStoredObject(stored.url).catch(() => {})
    throw error
  }
  res.json({ code: 0, data: { url: stored.url, name: req.file.originalname } })
})

export async function serveUpload(req, res) {
  const filename = String(req.params.filename || '')
  if (!/^[a-f0-9]{32}\.(png|jpe?g|gif|webp)$/i.test(filename)) {
    return res.status(404).json({ message: '图片不存在' })
  }
  const filePath = `/uploads/${filename}`
  let allowed = req.user.role === 'admin'

  if (!allowed) {
    const ownedUpload = await one(
      'SELECT 1 FROM uploaded_files WHERE file_path = ? AND user_id = ? LIMIT 1',
      [filePath, req.user.id]
    )
    allowed = Boolean(ownedUpload)
  }
  if (!allowed) {
    const visibleCase = await one(
      `SELECT 1 FROM submissions
       WHERE (user_id = ? OR status = 'published')
         AND JSON_CONTAINS(COALESCE(images, JSON_ARRAY()), JSON_QUOTE(?))
       LIMIT 1`,
      [req.user.id, filePath]
    )
    allowed = Boolean(visibleCase)
  }
  if (!allowed) {
    const ownedMessage = await one(
      `SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ? AND m.content LIKE CONCAT('[image:', ?, ']%') LIMIT 1`,
      [req.user.id, filePath]
    )
    allowed = Boolean(ownedMessage)
  }
  if (!allowed) {
    const ownedDraft = await one(
      `SELECT 1 FROM case_drafts
       WHERE user_id = ? AND JSON_SEARCH(payload, 'one', ?) IS NOT NULL LIMIT 1`,
      [req.user.id, filePath]
    )
    allowed = Boolean(ownedDraft)
  }
  if (!allowed) return res.status(404).json({ message: '图片不存在' })

  let buffer
  try {
    buffer = await downloadStoredObject(filePath)
  } catch (error) {
    if (error.code === 'ENOENT' || error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ message: '图片不存在' })
    }
    throw error
  }
  res.setHeader('Content-Type', storedObjectContentType(filePath))
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.send(buffer)
}

export default router
