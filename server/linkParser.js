// AI 分享链接解析器 —— 识别平台 + 提取 prompt 和 AI 回答
// DeepSeek: 通过内部 API (/api/v0/share/content) 获取结构化数据
// 其他平台: 通过 OG meta 标签提取（后续可接入各平台 API 增强）

const TIMEOUT_MS = 15000
const MAX_BODY_BYTES = 2 * 1024 * 1024 // 2MB

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const PLATFORMS = [
  { pattern: /chat\.deepseek\.com\/share\//, name: 'deepseek' },
  { pattern: /chatgpt\.com\/share\//, name: 'chatgpt' },
  { pattern: /claude\.ai\/share\//, name: 'claude' },
  { pattern: /kimi\.moonshot\.cn\/share\//, name: 'kimi' },
  { pattern: /tongyi\.aliyun\.com\/.*\/share\//, name: 'qwen' },
]

function detectPlatform(url) {
  for (const p of PLATFORMS) {
    if (p.pattern.test(url)) return p.name
  }
  return 'other'
}

// 通用 HTTP 请求
async function fetchJson(url, opts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', ...opts.headers },
      signal: controller.signal,
      ...opts,
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const text = await resp.text()
    return JSON.parse(text)
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('请求超时，请检查链接是否正确')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function fetchHtml(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    let size = 0
    const chunks = []
    const reader = resp.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BODY_BYTES) { reader.cancel(); break }
      chunks.push(value)
    }
    return Buffer.concat(chunks).toString('utf-8')
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('请求超时，请检查链接是否正确')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ====== DeepSeek: 使用内部 API ======

function extractShareId(url) {
  const m = url.match(/\/share\/([a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

async function parseDeepSeek(url) {
  const shareId = extractShareId(url)
  if (!shareId) throw new Error('无法从链接中提取 DeepSeek 分享 ID')

  const apiUrl = `https://chat.deepseek.com/api/v0/share/content?share_id=${shareId}`
  const json = await fetchJson(apiUrl)

  const messages = json?.data?.biz_data?.messages
  if (!messages || !messages.length) {
    throw new Error('未找到对话内容')
  }

  // 取第一轮 user 和 assistant 消息
  const userMsg = messages.find(m => m.role === 'USER')
  const assistantMsg = messages.find(m => m.role === 'ASSISTANT')

  const prompt = userMsg?.content || ''
  const aiAnswer = assistantMsg?.content || ''
  const files = (userMsg?.files || []).map(f => ({ name: f.file_name, size: f.file_size }))

  return { prompt, aiAnswer, files }
}

// ====== 通用 HTML/OG 解析（其他平台的兜底方案）======

function getMeta(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=(?:"|')og:${prop}(?:"|')[^>]+content=(?:"|')([^"']*)(?:"|')`,
    'i'
  )
  const m = html.match(re)
  if (m) return m[1]
  const re2 = new RegExp(
    `<meta[^>]+content=(?:"|')([^"']*)(?:"|')[^>]+(?:property|name)=(?:"|')og:${prop}(?:"|')`,
    'i'
  )
  const m2 = html.match(re2)
  return m2 ? m2[1] : ''
}

function getTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m ? m[1].trim() : ''
}

async function parseGeneric(url) {
  const html = await fetchHtml(url)
  if (!html || html.length < 100) throw new Error('无法读取页面内容，请检查链接')

  const ogTitle = getMeta(html, 'title')
  const ogDesc = getMeta(html, 'description')
  const pageTitle = getTitle(html)

  let prompt = ''
  if (ogTitle && !/deepseek|chatgpt|claude|kimi|通义/i.test(ogTitle)) {
    prompt = ogTitle
  } else if (pageTitle) {
    prompt = pageTitle
  }

  return { prompt, aiAnswer: ogDesc || '', files: [] }
}

// ====== 主入口 ======

async function parseLink(url) {
  const platform = detectPlatform(url)

  if (platform === 'deepseek') {
    const result = await parseDeepSeek(url)
    return { platform, ...result }
  }

  // 其他平台：当前使用 OG 标签解析，后续可接入各平台 API
  const result = await parseGeneric(url)
  return { platform, ...result }
}

export { parseLink, detectPlatform }
