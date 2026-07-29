import { ollama } from '../ai.js'
import { OLLAMA_TEXT_MODEL, VISION_MODEL } from '../config.js'

const ROLE_MARKER = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(用户|user|you|human|assistant|ai|chatgpt|gemini|deepseek|kimi|豆包|doubao|claude|通义千问|qwen|chatglm|glm)(?:\*\*)?\s*(?:said|说)?\s*[:：]?\s*/gim

function normalizeRole(label) {
  return /^(用户|user|you|human)$/i.test(label) ? 'user' : 'assistant'
}

function normalizePlatform(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('deepseek')) return 'deepseek'
  if (text.includes('chatgpt') || text.includes('openai')) return 'chatgpt'
  if (text.includes('gemini')) return 'gemini'
  if (text.includes('kimi')) return 'kimi'
  if (text.includes('豆包') || text.includes('doubao')) return 'doubao'
  if (text.includes('claude')) return 'claude'
  if (text.includes('通义') || text.includes('qwen')) return 'qwen'
  if (text.includes('chatglm') || text === 'glm') return 'glm'
  return ''
}

export function parseImportedConversationText(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return null

  const markers = []
  ROLE_MARKER.lastIndex = 0
  let match
  while ((match = ROLE_MARKER.exec(`\n${text}`))) {
    markers.push({
      role: normalizeRole(match[1]),
      label: match[1],
      markerStart: match.index,
      contentStart: match.index + match[0].length,
    })
  }
  const source = `\n${text}`
  const messages = markers.map((marker, index) => ({
    ...marker,
    content: source.slice(marker.contentStart, markers[index + 1]?.markerStart ?? source.length).trim(),
  })).filter(item => item.content)

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role !== 'assistant') continue
    const user = messages.slice(0, index).findLast(item => item.role === 'user')
    if (!user) continue
    return {
      prompt: user.content,
      aiAnswer: messages[index].content,
      platform: normalizePlatform(messages[index].label),
      method: 'roles',
    }
  }
  return null
}

function jsonObjectFrom(raw) {
  const match = String(raw || '').match(/\{[\s\S]*\}/)
  if (!match) throw new Error('模型没有返回可读取的结构化结果')
  const parsed = JSON.parse(match[0])
  const prompt = String(parsed.prompt || '').trim()
  const aiAnswer = String(parsed.aiAnswer || parsed.answer || '').trim()
  if (!prompt || !aiAnswer) throw new Error('没有识别到完整的用户问题和 AI 回答')
  return { prompt, aiAnswer, platform: normalizePlatform(parsed.platform) }
}

export async function importConversationText(raw, platform = '') {
  const local = parseImportedConversationText(raw)
  if (local) return { ...local, platform: platform || local.platform }

  const completion = await ollama.chat.completions.create({
    model: OLLAMA_TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: `从用户复制的 AI 对话中逐字提取最后一组用户问题和紧随其后的 AI 回答，不要总结、改写或补充。
只输出 JSON：{"prompt":"原始用户问题","aiAnswer":"原始AI回答","platform":"deepseek|chatgpt|gemini|kimi|doubao|claude|qwen|glm|other"}`,
      },
      { role: 'user', content: String(raw || '').slice(0, 50000) },
    ],
    temperature: 0,
    max_tokens: 5000,
  })
  const result = jsonObjectFrom(completion.choices[0]?.message?.content)
  return { ...result, platform: platform || result.platform, method: 'llama' }
}

export async function importConversationScreenshots(files, platform = '') {
  const images = files.map(file => ({
    type: 'image_url',
    image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}` },
  }))
  const completion = await ollama.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'system',
        content: `你是对话截图转录工具。按图片上传顺序，逐字提取最后一组用户问题和 AI 回答，不要评价、总结或改写。
只输出 JSON：{"prompt":"原始用户问题","aiAnswer":"原始AI回答","platform":"deepseek|chatgpt|gemini|kimi|doubao|claude|qwen|glm|other"}`,
      },
      {
        role: 'user',
        content: [{ type: 'text', text: '识别这些连续的 AI 对话截图。' }, ...images],
      },
    ],
    temperature: 0,
    max_tokens: 5000,
  })
  const result = jsonObjectFrom(completion.choices[0]?.message?.content)
  return { ...result, platform: platform || result.platform, method: 'vision', model: VISION_MODEL }
}
