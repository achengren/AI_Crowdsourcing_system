export const ERROR_TYPES = [
  'factual_error',
  'missing_information',
  'image_understanding_failure',
  'irrelevant_answer',
  'reasoning_error',
  'misleading_expression',
  'capability_limitation',
  'other',
]

export const KNOWLEDGE_SCENARIOS = [
  'campus_information',
  'latest_news',
  'domain_knowledge',
  'database_query',
  'login_required',
  'other',
]

export const SOURCE_ISSUES = [
  'none',
  'missing_source',
  'unverifiable_source',
  'unreliable_source',
  'source_content_mismatch',
  'other',
]

export function normalizeCaseTaxonomy(data = {}) {
  const errorTypes = Array.isArray(data.errorTypes)
    ? [...new Set(data.errorTypes)]
    : [data.errorType || 'other']
  const knowledgeScenarios = [...new Set(data.knowledgeScenarios || [])]
  const sourceIssues = Array.isArray(data.sourceIssues)
    ? [...new Set(data.sourceIssues.filter(value => value !== 'none'))]
    : data.sourceIssue && data.sourceIssue !== 'none' ? [data.sourceIssue] : []
  return { errorTypes, knowledgeScenarios, sourceIssues }
}

export function caseTaxonomyError(data = {}) {
  const { errorTypes, knowledgeScenarios, sourceIssues } = normalizeCaseTaxonomy(data)
  if (!errorTypes.length) return '请至少选择一个错误类型'
  if (errorTypes.includes('other') && !String(data.errorTypeOther || '').trim()) return '请具体说明其他错误类型'
  if (knowledgeScenarios.includes('other') && !String(data.knowledgeScenarioOther || '').trim()) return '请具体说明其他知识场景'
  if (sourceIssues.includes('other') && !String(data.sourceIssueOther || '').trim()) return '请具体说明其他来源问题'
  return null
}
