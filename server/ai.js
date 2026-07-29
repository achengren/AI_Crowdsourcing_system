import 'dotenv/config'
import OpenAI from 'openai'
import { DEEPSEEK_BASE_URL, OLLAMA_BASE_URL } from './config.js'

export const hasDeepSeekApiKey = Boolean(process.env.DEEPSEEK_API_KEY)

export const deepseek = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  // The DeepSeek client is kept for optional switching, but Ollama must work
  // without requiring an unrelated DeepSeek credential at server startup.
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-configured',
  maxRetries: 0,
})

export const ollama = new OpenAI({
  baseURL: OLLAMA_BASE_URL,
  apiKey: 'ollama',
  maxRetries: 0,
})
