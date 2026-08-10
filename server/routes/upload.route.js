import { Router } from 'express'
import { authMiddleware, upload } from '../middleware.js'
import { storeUpload } from '../services/storage.js'
import { query } from '../db.js'

const router = Router()

router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请选择图片文件' })
  }
  const stored = await storeUpload(req.file)
  await query('INSERT INTO uploaded_files (file_path, user_id) VALUES (?, ?)', [stored.url, req.user.id])
  res.json({ code: 0, data: { url: stored.url, name: req.file.originalname } })
})

export default router
