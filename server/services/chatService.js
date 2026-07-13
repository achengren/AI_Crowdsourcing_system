import { VISION_MODEL, DEEPSEEK_MODEL, TITLE_MODEL } from '../config.js'
import { parseImageContent, readImageAsBase64 } from '../utils/image.js'
import { deepseek, ollama } from '../ai.js'

export async function sendVisionMessage(historyMessages, prompt, imageUrl) {
  const dataUrl = readImageAsBase64(imageUrl)

  const messages = [
    { role: 'system', content: '你是一个AI视觉助手。请仔细观察用户提供的图片，结合用户的文字描述，给出准确、详细的回答。使用Markdown格式回复。' },
  ]

  for (const msg of historyMessages) {
    if (msg.role === 'user') {
      const parsed = parseImageContent(msg.content)
      if (parsed.imageUrl) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: parsed.text || '请分析这张图片' },
            { type: 'image_url', image_url: { url: readImageAsBase64(parsed.imageUrl) } },
          ],
        })
      } else {
        messages.push({ role: 'user', content: msg.content })
      }
    } else {
      messages.push({ role: 'assistant', content: msg.content })
    }
  }

  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: prompt || '请分析这张图片' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  })

  const completion = await ollama.chat.completions.create({
    model: VISION_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2000,
  })

  return completion.choices[0]?.message?.content || '（未获取到回复）'
}

export async function sendTextMessage(historyMessages, prompt) {
  const messages = [
    { role: 'system', content: '你是一个AI助手。请只回答用户当前最新的问题，不要重复回答对话历史中已经解决过的问题。使用Markdown格式回复，让回答清晰易读。' },
    ...historyMessages.map(m => ({ role: m.role, content: parseImageContent(m.content).text })),
    { role: 'user', content: prompt },
  ]

  const completion = await deepseek.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2000,
  })

  return completion.choices[0]?.message?.content || '（未获取到回复）'
}

export async function generateTitle(prompt) {
  const titleRes = await ollama.chat.completions.create({
    model: TITLE_MODEL,
    messages: [
      { role: 'system', content: '你是一个标题生成器。根据用户的对话内容生成一个极简短标题（6-10个字），只输出标题本身，不要引号、换行或任何解释。' },
      { role: 'user', content: (prompt || '').slice(0, 300) },
    ],
    max_tokens: 20,
    temperature: 0.3,
  })
  return (titleRes.choices[0]?.message?.content || '').replace(/["'\n]/g, '').trim().slice(0, 20)
}
