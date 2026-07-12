import { defineStore } from 'pinia'

function loadUser() {
  try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: loadUser(),
    token: localStorage.getItem('token') || null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isGuest: (state) => state.user?.role === 'guest',
  },

  actions: {
    login(token, user) {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      this.token = token
      this.user = user
    },

    loginAsGuest() {
      localStorage.setItem('token', 'guest')
      this.token = 'guest'
      this.user = { id: 'guest', name: '游客', role: 'guest' }
    },

    logout() {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      this.token = null
      this.user = null
    },
  },
})
