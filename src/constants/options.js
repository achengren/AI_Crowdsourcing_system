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

export const CASE_CATEGORIES = [
  { value: 'factual_error', label: '事实错误' },
  { value: 'campus_info', label: '校园信息缺失' },
  { value: 'news', label: '最新新闻/时事' },
  { value: 'domain_knowledge', label: '特定领域知识' },
  { value: 'unreliable_source', label: '参考来源不可信' },
  { value: 'unverifiable', label: '信息来源不可验证' },
  { value: 'no_source', label: '无法提供参考来源' },
  { value: 'image_understanding', label: '图片理解失败' },
  { value: 'interaction_unsatisfied', label: '答非所问或交互不满意' },
  { value: 'workflow', label: '工作流不匹配' },
  { value: 'other', label: '其他' },
]

export const ISSUE_TYPES = [
  '事实错误', '来源问题', '信息缺失', '过时信息', '逻辑问题', '答非所问', '表达误导', '其他',
]

export function optionLabel(options, value) {
  return options.find(item => item.value === value)?.label || value
}
