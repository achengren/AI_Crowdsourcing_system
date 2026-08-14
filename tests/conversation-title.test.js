import test from 'node:test'
import assert from 'node:assert/strict'
import { fallbackConversationTitle, sanitizeConversationTitle } from '../server/services/conversationTitle.js'

test('generated conversation titles are normalized into concise topic phrases', () => {
  assert.equal(sanitizeConversationTitle('标题：北京大学图书馆开放时间。', '请问北大图书馆几点关门？'), '北京大学图书馆开放时间')
  assert.equal(sanitizeConversationTitle('“校园网连接故障”\n这里是解释', '校园网为什么连不上'), '校园网连接故障')
  assert.equal(Array.from(sanitizeConversationTitle('这是一个超过十八个汉字并且应该被截断的会话主题名称', '备用标题')).length, 18)
})

test('generic model output falls back to the cleaned first user request', () => {
  assert.equal(sanitizeConversationTitle('标题生成器', '请帮我分析校园网无法连接的原因'), '分析校园网无法连接的原因')
  assert.equal(sanitizeConversationTitle('以下是生成的标题', '我想知道课程作业提交时间'), '课程作业提交时间')
  assert.equal(sanitizeConversationTitle('', ''), '图片分析')
})

test('fallback titles remove wrappers and remain bounded', () => {
  assert.equal(fallbackConversationTitle('请问数据库密码应该在哪里配置？后面还有补充'), '数据库密码应该在哪里配置')
  assert.ok(Array.from(fallbackConversationTitle('请帮我处理一个非常非常非常非常非常非常长的问题描述')).length <= 19)
})
