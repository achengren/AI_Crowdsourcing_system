import test from 'node:test'
import assert from 'node:assert/strict'
import { contextWithSummary, estimateTokens, selectContextWindow } from '../server/services/contextWindow.js'

test('token estimate weighs CJK text more densely than ASCII text', () => {
  assert.equal(estimateTokens('测试文本'), 4)
  assert.equal(estimateTokens('abcdefgh'), 2)
  assert.equal(estimateTokens('测试abcd'), 3)
})

test('context window retains the newest messages within the budget', () => {
  const messages = [
    { role: 'user', content: 'a'.repeat(2400) },
    { role: 'assistant', content: 'b'.repeat(2400) },
    { role: 'user', content: 'latest' },
  ]
  const selected = selectContextWindow(messages, 3500, 2500)
  assert.equal(selected.messagesToSummarize.length, 1)
  assert.deepEqual(selected.recentMessages, messages.slice(1))
})

test('saved summary is prepended as system context', () => {
  const output = contextWithSummary('此前讨论了课程要求。', [{ role: 'user', content: '继续' }])
  assert.equal(output.length, 2)
  assert.match(output[0].content, /此前讨论了课程要求/)
})
