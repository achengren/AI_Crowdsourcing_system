import test from 'node:test'
import assert from 'node:assert/strict'
import { parseImportedConversationText } from '../server/services/conversationImportService.js'

test('copied ChatGPT transcript imports the user and assistant messages', () => {
  const result = parseImportedConversationText(`You said:
How should I verify this source?

ChatGPT said:
Check the publication date and the original publisher.`)
  assert.deepEqual(result, {
    prompt: 'How should I verify this source?',
    aiAnswer: 'Check the publication date and the original publisher.',
    platform: 'chatgpt',
    method: 'roles',
  })
})

test('multi-turn Chinese transcript imports the last complete pair', () => {
  const result = parseImportedConversationText(`用户：第一问
豆包：第一答
用户：第二问
豆包：第二答`)
  assert.equal(result.prompt, '第二问')
  assert.equal(result.aiAnswer, '第二答')
  assert.equal(result.platform, 'doubao')
})

test('unlabelled copied text falls back to model extraction', () => {
  assert.equal(parseImportedConversationText('只有一段没有角色标签的内容'), null)
})
