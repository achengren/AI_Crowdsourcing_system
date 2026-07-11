import client from './client'

export function sendMessage({ model, prompt }) {
  return client.post('/chat/send', { model, prompt })
}
