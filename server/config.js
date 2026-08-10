import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const NODE_ENV = process.env.NODE_ENV || 'development'
export const JWT_SECRET = process.env.JWT_SECRET || 'local-development-only-change-me'
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'hib_session'
export const AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE
  ? process.env.AUTH_COOKIE_SECURE === 'true'
  : NODE_ENV === 'production'
export const PORT = Number(process.env.PORT || 3001)
export const UPLOADS_DIR = path.join(__dirname, 'uploads')
export const DIST_DIR = path.join(__dirname, '..', 'dist')

export const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'ai_crowdsourcing',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ai_crowdsourcing',
  connectionLimit: Number(process.env.DB_POOL_SIZE || 15),
}

export const ADMIN_BOOTSTRAP = {
  studentId: process.env.ADMIN_STUDENT_ID || '',
  name: process.env.ADMIN_NAME || '系统管理员',
  password: process.env.ADMIN_PASSWORD || '',
}

export const STORAGE_CONFIG = {
  driver: process.env.STORAGE_DRIVER || 'local',
  s3: {
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    keyPrefix: (process.env.S3_KEY_PREFIX || 'uploads').replace(/^\/+|\/+$/g, ''),
  },
}

// AI
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL?.trim() || ''
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL?.trim() || ''
export const OLLAMA_TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL?.trim() || ''
export const VISION_MODEL = process.env.VISION_MODEL?.trim() || ''
export const TITLE_MODEL = process.env.TITLE_MODEL?.trim() || ''
export const AI_CONTEXT_TOKEN_BUDGET = Math.max(4000, Number(process.env.AI_CONTEXT_TOKEN_BUDGET || 16000))
export const AI_TEXT_TIMEOUT_MS = Math.max(5000, Number(process.env.AI_TEXT_TIMEOUT_MS || 45000))
export const AI_VISION_TIMEOUT_MS = Math.max(5000, Number(process.env.AI_VISION_TIMEOUT_MS || 60000))
export const AI_TEXT_MAX_RETRIES = Math.max(0, Number(process.env.AI_TEXT_MAX_RETRIES || 1))
export const AI_VISION_MAX_RETRIES = Math.max(0, Number(process.env.AI_VISION_MAX_RETRIES || 1))

export function validateRuntimeConfig() {
  if (NODE_ENV === 'production' && JWT_SECRET === 'local-development-only-change-me') {
    throw new Error('生产环境必须设置 JWT_SECRET 环境变量')
  }
  const required = { DEEPSEEK_MODEL, OLLAMA_BASE_URL, OLLAMA_TEXT_MODEL, VISION_MODEL, TITLE_MODEL }
  const missing = Object.entries(required).filter(([, value]) => !value).map(([name]) => name)
  if (missing.length) throw new Error(`缺少必要的 AI 环境变量: ${missing.join(', ')}`)
}

export const UPLOAD_MAX_SIZE = 5 * 1024 * 1024
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
export const DAILY_SUBMISSION_LIMIT = 5
export const WEEKLY_SUBMISSION_LIMIT = 20

export const ALLOWED_LINK_HOSTS = [
  'chat.deepseek.com',
  'chatgpt.com',
  'chat.openai.com',
  'gemini.google.com',
  'claude.ai',
  'kimi.moonshot.cn',
  'kimi.com',
  'doubao.com',
  'chatglm.cn',
  'chatglm.com',
  'tongyi.aliyun.com',
]
