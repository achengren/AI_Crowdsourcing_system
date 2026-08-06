export const PLATFORM_OPTIONS = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'qwen', label: '通义千问' },
  { value: 'doubao', label: '豆包' },
  { value: 'glm', label: 'GLM' },
  { value: 'other', label: '其他' },
]

export const ERROR_TYPE_OPTIONS = [
  { value: 'factual_error', label: '事实错误' },
  { value: 'missing_information', label: '信息缺失' },
  { value: 'image_understanding_failure', label: '图片理解失败' },
  { value: 'irrelevant_answer', label: '答非所问' },
  { value: 'reasoning_error', label: '推理或逻辑错误' },
  { value: 'misleading_expression', label: '表达误导' },
  { value: 'capability_limitation', label: '无法执行请求或工具能力不足' },
  { value: 'other', label: '其他' },
]

export const KNOWLEDGE_SCENARIO_OPTIONS = [
  { value: 'campus_information', label: '校园信息' },
  { value: 'latest_news', label: '最新新闻或时事' },
  { value: 'domain_knowledge', label: '特定领域知识' },
  { value: 'database_query', label: '数据库查询' },
  { value: 'login_required', label: '需要登录的信息' },
  { value: 'other', label: '其他场景' },
]

export const SOURCE_ISSUE_OPTIONS = [
  { value: 'none', label: '无来源问题' },
  { value: 'missing_source', label: '未提供来源' },
  { value: 'unverifiable_source', label: '来源不可验证' },
  { value: 'unreliable_source', label: '来源不可靠' },
  { value: 'source_content_mismatch', label: '来源与回答不一致' },
  { value: 'other', label: '其他来源问题' },
]

export const LEGACY_CATEGORY_OPTIONS = [
  { value: 'campus_info', label: '校园信息缺失（旧分类）' },
  { value: 'news', label: '最新新闻/时事（旧分类）' },
  { value: 'domain_knowledge', label: '特定领域知识（旧分类）' },
  { value: 'unreliable_source', label: '参考来源不可信（旧分类）' },
  { value: 'unverifiable', label: '信息来源不可验证（旧分类）' },
  { value: 'no_source', label: '无法提供参考来源（旧分类）' },
  { value: 'image_understanding', label: '图片理解失败（旧分类）' },
  { value: 'interaction_unsatisfied', label: '交互不满意（旧分类）' },
  { value: 'workflow', label: '工作流不匹配（旧分类）' },
]

export const CASE_CATEGORIES = [...ERROR_TYPE_OPTIONS, ...LEGACY_CATEGORY_OPTIONS]
export const ISSUE_TYPES = ERROR_TYPE_OPTIONS

export function optionLabel(options, value) {
  return options.find(item => item.value === value)?.label || value
}

export function platformLabel(platform, platformOther = '') {
  return platform === 'other' && platformOther ? platformOther : optionLabel(PLATFORM_OPTIONS, platform)
}
