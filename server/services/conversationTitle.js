const GENERIC_TITLES = new Set(['标题生成器', '会话标题', '对话标题', '用户问题', '未命名对话', '新对话'])

function takeCharacters(value, limit) {
  return Array.from(value).slice(0, limit).join('')
}

export function fallbackConversationTitle(prompt) {
  const cleaned = String(prompt || '')
    .replace(/\[image:[^\]]+\]/gi, ' ')
    .replace(/[`#*_>~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:请问|请帮我|可以帮我|帮我|我想(?:问|知道|了解)|能否|麻烦)\s*/u, '')
  const topic = cleaned.split(/[。！？!?；;\n]/u)[0].trim() || '图片分析'
  return `${takeCharacters(topic, 18)}${Array.from(topic).length > 18 ? '…' : ''}`
}

export function sanitizeConversationTitle(rawTitle, prompt) {
  const fallback = fallbackConversationTitle(prompt)
  const title = String(rawTitle || '')
    .split(/\r?\n/)[0]
    .replace(/^[\s"'“”‘’`#*]+|[\s"'“”‘’`#*]+$/g, '')
    .replace(/^(?:标题|会话标题|对话标题)\s*[:：-]\s*/i, '')
    .replace(/[。！？!?；;，,：:]$/u, '')
    .trim()
  if (
    Array.from(title).length < 2
    || GENERIC_TITLES.has(title)
    || /(?:标题生成器|我是.*标题|根据.*生成.*标题|以下是.*标题)/u.test(title)
  ) return fallback
  return takeCharacters(title, 18)
}
