import client from './client'

export function sendMessage({ prompt, conversationId, imageUrl }) {
  return client.post('/chat/send', { prompt, conversationId, imageUrl }, { timeout: 240000 })
}

export function getConversations() {
  return client.get('/conversations')
}

export function createConversation(title) {
  return client.post('/conversations', { title })
}

export function getMessages(conversationId) {
  return client.get(`/conversations/${conversationId}/messages`)
}

export function getSolutionSuggestion(prompt, reply) {
  return client.post('/chat/solution-suggestion', { prompt, reply })
}
