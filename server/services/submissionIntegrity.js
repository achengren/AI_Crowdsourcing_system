export function extractUserMessage(content) {
  const raw = String(content || '')
  const imageMatch = raw.match(/^\[image:(.+?)\]\n/)
  return {
    prompt: raw.replace(/^\[image:(.+?)\]\n/, ''),
    imageUrl: imageMatch?.[1] || '',
  }
}

export function lockSubmissionToMessage(submission, source, userMessageContent) {
  const userMessage = extractUserMessage(userMessageContent)
  return {
    ...submission,
    prompt: userMessage.prompt,
    aiAnswer: source.aiAnswer,
    platform: source.platform,
    model: source.model,
    images: userMessage.imageUrl ? [userMessage.imageUrl] : submission.images,
  }
}

export function annotationIntegrityError(text, annotations) {
  const sourceText = String(text || '')
  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset)
  let previousEnd = 0

  for (const item of sorted) {
    if (item.startOffset >= item.endOffset || item.endOffset > sourceText.length) {
      return '批注位置超出 AI 回复范围，请重新选择问题片段'
    }
    if (item.startOffset < previousEnd) {
      return '批注片段不能互相重叠，请调整后再提交'
    }
    if (sourceText.slice(item.startOffset, item.endOffset) !== item.selectedText) {
      return '批注原文与 AI 回复不一致，请重新选择问题片段'
    }
    previousEnd = item.endOffset
  }
  return null
}
