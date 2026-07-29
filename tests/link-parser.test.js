import test from 'node:test'
import assert from 'node:assert/strict'
import { detectPlatform, extractConversationFromHtml, isAllowedUrl } from '../server/linkParser.js'

test('detectPlatform recognizes supported public share hosts', () => {
  const cases = [
    ['https://chatgpt.com/share/example', 'chatgpt'],
    ['https://gemini.google.com/share/example', 'gemini'],
    ['https://kimi.moonshot.cn/share/example', 'kimi'],
    ['https://www.doubao.com/thread/example', 'doubao'],
    ['https://chatglm.cn/share/example', 'glm'],
  ]
  for (const [url, platform] of cases) assert.equal(detectPlatform(url), platform)
})

test('link allowlist accepts supported subdomains and rejects arbitrary hosts', () => {
  assert.equal(isAllowedUrl('https://www.doubao.com/thread/example'), true)
  assert.equal(isAllowedUrl('https://evil.example/share/example'), false)
  assert.equal(isAllowedUrl('file:///etc/passwd'), false)
})

test('extractConversationFromHtml reads visible ChatGPT message roles', () => {
  const html = `
    <main>
      <article data-message-author-role="user"><p>如何核验这条新闻？</p></article>
      <article data-message-author-role="assistant"><p>可以查看消息来源和发布日期。</p></article>
    </main>`
  assert.deepEqual(extractConversationFromHtml(html), {
    prompt: '如何核验这条新闻？',
    aiAnswer: '可以查看消息来源和发布日期。',
  })
})

test('extractConversationFromHtml reads embedded provider state', () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    conversation: {
      messages: [
        { role: 'user', content: '北京大学图书馆几点闭馆？' },
        { role: 'assistant', content: '通常为晚上十点，请以官网当日通知为准。' },
      ],
    },
  })}</script>`
  assert.deepEqual(extractConversationFromHtml(html), {
    prompt: '北京大学图书馆几点闭馆？',
    aiAnswer: '通常为晚上十点，请以官网当日通知为准。',
  })
})
