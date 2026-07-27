import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const JWT_SECRET = 'ai-crowdsourcing-secret-key-2024'
export const DB_PATH = path.join(__dirname, 'data.db')
export const PORT = 3001
export const UPLOADS_DIR = path.join(__dirname, 'uploads')

// AI
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const OLLAMA_BASE_URL = 'http://162.105.154.176:11434/v1'
export const DEEPSEEK_MODEL = 'deepseek-chat'
export const OLLAMA_TEXT_MODEL = 'llama3.1:8b'
export const VISION_MODEL = 'qwen3-vl:8b'
export const TITLE_MODEL = 'llama3.1:8b'

// 上传限制
export const UPLOAD_MAX_SIZE = 5 * 1024 * 1024
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

// 提交限制
export const DAILY_SUBMISSION_LIMIT = 5
export const WEEKLY_SUBMISSION_LIMIT = 20

// 链接解析白名单
export const ALLOWED_LINK_HOSTS = [
  'chat.deepseek.com',
  'chatgpt.com',
  'claude.ai',
  'kimi.moonshot.cn',
  'tongyi.aliyun.com',
]
