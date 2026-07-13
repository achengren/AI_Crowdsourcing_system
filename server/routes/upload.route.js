import { Router } from 'express'
import { authMiddleware, upload } from '../middleware.js'

const router = Router()

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请选择图片文件' })
  }
  const url = `/uploads/${req.file.filename}`
  res.json({ code: 0, data: { url, name: req.file.originalname } })
})

export default router
