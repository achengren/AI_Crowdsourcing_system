import client from './client'

export function login({ studentId, password }) {
  return client.post('/auth/login', { studentId, password })
}

export function logout() {
  return client.post('/auth/logout')
}

export function getMe() {
  return client.get('/auth/me')
}

export function changePassword(data) {
  return client.post('/auth/change-password', data)
}
