import client from './client'

export function sendMessage({ prompt, conversationId }) {
  return client.post('/chat/send', { prompt, conversationId })
}

export function getConversations() {
  return client.get('/conversations')
}

export function createConversation(title) {
  return client.post('/conversations', { title })
}

export function deleteConversation(id) {
  return client.delete(`/conversations/${id}`)
}

export function getMessages(conversationId) {
  return client.get(`/conversations/${conversationId}/messages`)
}
