import { defineStore } from 'pinia'

function loadUser() {
  try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: loadUser(), token: localStorage.getItem('token') || null }),
  getters: {
    isLoggedIn: state => Boolean(state.token),
    isAdmin: state => state.user?.role === 'admin',
  },
  actions: {
    login(token, user) {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      this.token = token
      this.user = user
    },
    updateUser(patch) {
      this.user = { ...this.user, ...patch }
      localStorage.setItem('user', JSON.stringify(this.user))
    },
    logout() {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      this.token = null
      this.user = null
    },
  },
})
