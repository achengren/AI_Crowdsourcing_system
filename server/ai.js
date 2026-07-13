import 'dotenv/config'
import OpenAI from 'openai'
import { DEEPSEEK_BASE_URL, OLLAMA_BASE_URL } from './config.js'

export const deepseek = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: process.env.DEEPSEEK_API_KEY,
})

export const ollama = new OpenAI({
  baseURL: OLLAMA_BASE_URL,
  apiKey: 'ollama',
})
