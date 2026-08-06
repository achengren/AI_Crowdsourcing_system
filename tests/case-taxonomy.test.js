import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ERROR_TYPES,
  KNOWLEDGE_SCENARIOS,
  SOURCE_ISSUES,
  caseTaxonomyError,
  normalizeCaseTaxonomy,
} from '../server/services/caseTaxonomy.js'

test('case taxonomy separates errors, knowledge scenarios and source issues', () => {
  assert.ok(ERROR_TYPES.includes('factual_error'))
  assert.ok(ERROR_TYPES.includes('missing_information'))
  assert.ok(KNOWLEDGE_SCENARIOS.includes('latest_news'))
  assert.equal(ERROR_TYPES.includes('latest_news'), false)
  assert.ok(SOURCE_ISSUES.includes('unverifiable_source'))
  assert.equal(ERROR_TYPES.includes('unverifiable_source'), false)
})

test('case taxonomy keeps multiple selections and removes duplicates', () => {
  assert.deepEqual(normalizeCaseTaxonomy({
    errorTypes: ['factual_error', 'missing_information', 'factual_error'],
    knowledgeScenarios: ['latest_news', 'domain_knowledge'],
    sourceIssues: ['none', 'missing_source', 'missing_source'],
  }), {
    errorTypes: ['factual_error', 'missing_information'],
    knowledgeScenarios: ['latest_news', 'domain_knowledge'],
    sourceIssues: ['missing_source'],
  })
})

test('case taxonomy rejects empty error types and unexplained other values', () => {
  assert.match(caseTaxonomyError({ errorTypes: [] }), /至少选择一个错误类型/)
  assert.match(caseTaxonomyError({ errorTypes: ['other'] }), /其他错误类型/)
  assert.match(caseTaxonomyError({ errorTypes: ['factual_error'], knowledgeScenarios: ['other'] }), /其他知识场景/)
  assert.match(caseTaxonomyError({ errorTypes: ['factual_error'], sourceIssues: ['other'] }), /其他来源问题/)
  assert.equal(caseTaxonomyError({
    errorTypes: ['other'], errorTypeOther: '时间计算错误',
    knowledgeScenarios: ['other'], knowledgeScenarioOther: '课程作业',
    sourceIssues: ['other'], sourceIssueOther: '引用格式错误',
  }), null)
})
