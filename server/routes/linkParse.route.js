import { Router } from 'express'
import { authMiddleware } from '../middleware.js'
import { ALLOWED_LINK_HOSTS } from '../config.js'
import { parseLink } from '../linkParser.js'

const router = Router()

router.post('/', authMiddleware, async (req, res) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: '请提供要解析的链接' })
  }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return res.status(400).json({ message: '链接格式无效' })
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ message: '仅支持 http/https 链接' })
  }

  const isAllowed = ALLOWED_LINK_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))
  if (!isAllowed) {
    return res.status(400).json({ message: '暂不支持该网站的链接解析' })
  }

  try {
    const result = await parseLink(url)
    res.json({ code: 0, data: result })
  } catch (err) {
    console.error('链接解析失败:', err.message)
    res.status(400).json({ message: err.message || '解析失败，请手动填写内容' })
  }
})

export default router
