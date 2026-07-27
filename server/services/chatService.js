import { VISION_MODEL, OLLAMA_TEXT_MODEL, TITLE_MODEL } from '../config.js'
import { parseImageContent, readImageAsBase64 } from '../utils/image.js'
import { ollama } from '../ai.js'

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

  const completion = await ollama.chat.completions.create({
    model: OLLAMA_TEXT_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2000,
  })

  return completion.choices[0]?.message?.content || '（未获取到回复）'
}

export async function generateTitle(prompt) {
  const text = (prompt || '').trim() || '用户上传了一张图片请AI分析'
  const titleRes = await ollama.chat.completions.create({
    model: TITLE_MODEL,
    messages: [
      { role: 'system', content: '你是一个标题生成器。根据用户的对话内容生成一个极简短标题（6-10个字），只输出标题本身，不要引号、换行或任何解释。' },
      { role: 'user', content: text.slice(0, 300) },
    ],
    max_tokens: 20,
    temperature: 0.3,
  })
  return (titleRes.choices[0]?.message?.content || '').replace(/["'\n]/g, '').trim().slice(0, 20)
}

export async function evaluateResponseQuality(reply, prompt) {
  if (!reply || reply === '（未获取到回复）') {
    return { isLowQuality: true, reasons: ['AI 未能生成有效回复'] }
  }

  try {
    const evalRes = await ollama.chat.completions.create({
      model: TITLE_MODEL,
      messages: [
        {
          role: 'system',
          content: `你是一个AI回答质量评估器。分析AI回答是否真正解决了用户的具体问题。

判断标准：
- 如果AI直接说"抱歉"、"无法"、"不能"等明确拒绝/回避回答 → poor
- 如果AI只给出了笼统建议但未提供用户要求的具体信息 → poor
- 如果AI转移话题、答非所问、或绕圈子 → poor
- 如果AI直接回答了用户问题且有实质内容 → good

只输出JSON，不要其他内容：{"quality":"good"|"poor","reason":"简短说明原因(15字内)"}`,
        },
        {
          role: 'user',
          content: `用户问题：${(prompt || '无文本').slice(0, 500)}\n\nAI回答：${reply.slice(0, 1000)}`,
        },
      ],
      max_tokens: 80,
      temperature: 0.1,
    })

    const raw = evalRes.choices[0]?.message?.content || ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.quality === 'poor') {
        return { isLowQuality: true, reasons: [parsed.reason || 'AI 回答质量不佳'] }
      }
    }
    return { isLowQuality: false, reasons: [] }
  } catch (e) {
    console.error('Quality evaluator failed, using fallback:', e.message)
    const reasons = []
    const evasiveCN = ['抱歉', '我无法', '我不能', '没有找到', '不清楚', '不确定', '难以', '无法提供', '无法回答']
    for (const phrase of evasiveCN) {
      if (reply.includes(phrase)) { reasons.push('内容可能存在信息缺失'); break }
    }
    return { isLowQuality: reasons.length > 0, reasons }
  }
}

export async function generateSolutionSuggestion(prompt, reply) {
  const evalRes = await ollama.chat.completions.create({
    model: TITLE_MODEL,
    messages: [
      {
        role: 'system',
        content: `你是一个AI使用顾问。用户向通用AI提问但未得到满意回答，请提供改进建议。

建议方向：
1. 是否需要换专业平台而非通用AI？（如学术问题用知网/Google Scholar，实时信息用搜索引擎/官方渠道，代码问题用GitHub/Stack Overflow等）
2. 是否需要优化提示词？（更具体、提供上下文、分步骤等）
3. 其他实用技巧

用简洁中文回答，3-5条建议，每条不超过30字，用换行分隔。`,
      },
      {
        role: 'user',
        content: `用户问题：${(prompt || '').slice(0, 500)}\n\nAI的回答（不满意）：${(reply || '').slice(0, 800)}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
  })
  return evalRes.choices[0]?.message?.content || ''
}
