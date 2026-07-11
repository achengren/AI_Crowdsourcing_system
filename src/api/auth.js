import client from './client'

export function login({ studentId, password }) {
  return client.post('/auth/login', { studentId, password })
}

export function logout() {
  return client.post('/auth/logout')
}
