import { ALLOWED_LINK_HOSTS } from './config.js'

const TIMEOUT_MS = 15000
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 4

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const PLATFORMS = [
  { hosts: ['chat.deepseek.com'], path: /\/share\//i, name: 'deepseek' },
  { hosts: ['chatgpt.com', 'chat.openai.com'], path: /\/share\//i, name: 'chatgpt' },
  { hosts: ['gemini.google.com'], path: /\/share\//i, name: 'gemini' },
  { hosts: ['kimi.moonshot.cn', 'kimi.com'], name: 'kimi' },
  { hosts: ['doubao.com'], name: 'doubao' },
  { hosts: ['chatglm.cn', 'chatglm.com'], name: 'glm' },
  { hosts: ['tongyi.aliyun.com'], name: 'qwen' },
]

function hostMatches(hostname, allowed) {
  return hostname === allowed || hostname.endsWith(`.${allowed}`)
}

function isAllowedUrl(url) {
  let parsed
  try { parsed = new URL(url) } catch { return false }
  return ['http:', 'https:'].includes(parsed.protocol)
    && ALLOWED_LINK_HOSTS.some(host => hostMatches(parsed.hostname, host))
}

function detectPlatform(url) {
  let parsed
  try { parsed = new URL(url) } catch { return 'other' }
  const match = PLATFORMS.find(item => (
    item.hosts.some(host => hostMatches(parsed.hostname, host))
      && (!item.path || item.path.test(parsed.pathname))
  ))
  return match?.name || 'other'
}

async function fetchResponse(url, accept) {
  let currentUrl = url
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!isAllowedUrl(currentUrl)) throw new Error('分享链接跳转到了不受支持的网站')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': UA,
          Accept: accept,
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
        redirect: 'manual',
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw new Error(`分享页面返回了无效重定向（HTTP ${response.status}）`)
        currentUrl = new URL(location, currentUrl).toString()
        continue
      }
      if (!response.ok) throw new Error(`分享页面暂时无法访问（HTTP ${response.status}）`)
      return response
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('读取分享页面超时')
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('分享链接重定向次数过多')
}

async function responseText(response) {
  let size = 0
  const chunks = []
  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new Error('分享页面内容过大，无法自动解析')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function fetchJson(url) {
  const response = await fetchResponse(url, 'application/json')
  return JSON.parse(await responseText(response))
}

async function fetchHtml(url) {
  const response = await fetchResponse(url, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
  return responseText(response)
}

function extractShareId(url) {
  const match = url.match(/\/share\/([a-zA-Z0-9_-]+)/)
  return match?.[1] || null
}

async function parseDeepSeek(url) {
  const shareId = extractShareId(url)
  if (!shareId) throw new Error('无法从链接中提取 DeepSeek 分享 ID')

  const json = await fetchJson(`https://chat.deepseek.com/api/v0/share/content?share_id=${shareId}`)
  const messages = json?.data?.biz_data?.messages
  if (!Array.isArray(messages) || !messages.length) throw new Error('分享页面中没有可读取的对话')

  const userMessage = messages.find(message => String(message.role).toLowerCase() === 'user')
  const assistantMessage = messages.find(message => String(message.role).toLowerCase() === 'assistant')
  const files = (userMessage?.files || []).map(file => ({ name: file.file_name, size: file.file_size }))
  return {
    prompt: textFrom(userMessage?.content),
    aiAnswer: textFrom(assistantMessage?.content),
    files,
  }
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function stripHtml(value = '') {
  return decodeHtml(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|article|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

function textFrom(value, depth = 0) {
  if (depth > 5 || value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return stripHtml(value)
  if (Array.isArray(value)) return value.map(item => textFrom(item, depth + 1)).filter(Boolean).join('\n')
  if (typeof value !== 'object') return ''

  const preferredKeys = ['text', 'content', 'value', 'body', 'parts', 'segments', 'message']
  for (const key of preferredKeys) {
    if (value[key] == null) continue
    const text = textFrom(value[key], depth + 1)
    if (text) return text
  }
  return ''
}

function normalizeRole(value) {
  const role = String(value || '').toLowerCase()
  if (/user|human|question|query|prompt/.test(role)) return 'user'
  if (/assistant|bot|model|answer|response|ai/.test(role)) return 'assistant'
  return ''
}

function roleFrom(object) {
  return normalizeRole(
    object?.role
    ?? object?.author?.role
    ?? object?.sender?.role
    ?? object?.sender
    ?? object?.message?.author?.role
    ?? object?.message?.role
    ?? object?.message_type
    ?? object?.messageType
  )
}

function collectMessages(root) {
  const messages = []
  const pairs = []
  const seenObjects = new WeakSet()
  const seenMessages = new Set()

  function addMessage(role, text) {
    const cleaned = String(text || '').trim()
    if (!role || cleaned.length < 2 || cleaned.length > 300000) return
    const key = `${role}:${cleaned}`
    if (seenMessages.has(key)) return
    seenMessages.add(key)
    messages.push({ role, text: cleaned })
  }

  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 30 || seenObjects.has(value)) return
    seenObjects.add(value)

    if (!Array.isArray(value)) {
      const question = textFrom(value.prompt ?? value.question ?? value.query ?? value.user_query)
      const answer = textFrom(value.answer ?? value.response ?? value.output ?? value.assistant_answer)
      if (question && answer) pairs.push({ prompt: question, aiAnswer: answer })

      const role = roleFrom(value)
      if (role) addMessage(role, textFrom(value.content ?? value.text ?? value.body ?? value.message ?? value.parts))
    }

    const children = Array.isArray(value) ? value : Object.values(value)
    children.forEach(child => visit(child, depth + 1))
  }

  visit(root)
  if (pairs.length) return pairs[0]
  const userIndex = messages.findIndex(message => message.role === 'user')
  if (userIndex < 0) return null
  const assistant = messages.slice(userIndex + 1).find(message => message.role === 'assistant')
  return assistant ? { prompt: messages[userIndex].text, aiAnswer: assistant.text } : null
}

function parseJsonCandidate(source) {
  const trimmed = decodeHtml(source).trim().replace(/;$/, '')
  const candidates = [trimmed]
  const assignmentIndex = trimmed.indexOf('=')
  if (assignmentIndex > 0) candidates.push(trimmed.slice(assignmentIndex + 1).trim().replace(/;$/, ''))

  for (const candidate of candidates) {
    if (!candidate || !['{', '[', '"'].includes(candidate[0])) continue
    try {
      const parsed = JSON.parse(candidate)
      if (typeof parsed === 'string' && ['{', '['].includes(parsed.trim()[0])) return JSON.parse(parsed)
      return parsed
    } catch { /* try the next representation */ }
  }
  return null
}

function extractConversationFromHtml(html) {
  const rolePattern = /<[^>]+data-message-author-role=(?:"|')(user|assistant)(?:"|')[^>]*>([\s\S]*?)(?=<[^>]+data-message-author-role=(?:"|')(?:user|assistant)(?:"|')|$)/gi
  const visibleMessages = []
  let roleMatch
  while ((roleMatch = rolePattern.exec(html))) {
    const text = stripHtml(roleMatch[2])
    if (text) visibleMessages.push({ role: roleMatch[1].toLowerCase(), text })
  }
  const visiblePair = collectMessages(visibleMessages)
  if (visiblePair) return visiblePair

  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
  let scriptMatch
  while ((scriptMatch = scriptPattern.exec(html))) {
    const parsed = parseJsonCandidate(scriptMatch[1])
    if (!parsed) continue
    const pair = collectMessages(parsed)
    if (pair) return pair
  }

  return null
}

function getMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=(?:"|')og:${property}(?:"|')[^>]+content=(?:"|')([^"']*)(?:"|')`, 'i'),
    new RegExp(`<meta[^>]+content=(?:"|')([^"']*)(?:"|')[^>]+(?:property|name)=(?:"|')og:${property}(?:"|')`, 'i'),
  ]
  return decodeHtml(patterns.map(pattern => html.match(pattern)?.[1]).find(Boolean) || '')
}

function getTitle(html) {
  return stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
}

async function parseGeneric(url, platform) {
  const html = await fetchHtml(url)
  if (!html || html.length < 100) throw new Error('分享页面没有返回可读取的内容')

  const conversation = extractConversationFromHtml(html)
  if (conversation?.prompt && conversation?.aiAnswer) return { ...conversation, files: [] }

  const title = getMeta(html, 'title') || getTitle(html)
  const description = getMeta(html, 'description')
  const genericTitle = /chatgpt|gemini|kimi|doubao|豆包|chatglm|智谱|通义|分享|share/i.test(title)
  if (title && description && !genericTitle && description.length >= 10) {
    return { prompt: title, aiAnswer: description, files: [] }
  }

  throw new Error(`${platform} 分享页未公开对话正文，可能需要登录或平台已更新页面结构`)
}

async function parseLink(url) {
  const platform = detectPlatform(url)
  if (platform === 'deepseek') return { platform, ...await parseDeepSeek(url) }
  return { platform, ...await parseGeneric(url, platform) }
}

export { detectPlatform, extractConversationFromHtml, isAllowedUrl, parseLink }
