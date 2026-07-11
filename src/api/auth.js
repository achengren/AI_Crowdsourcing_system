import client from './client'

export function login({ studentId, password }) {
  return client.post('/auth/login', { studentId, password })
}

export function register({ studentId, name, password }) {
  return client.post('/auth/register', { studentId, name, password })
}

export function logout() {
  return client.post('/auth/logout')
}
