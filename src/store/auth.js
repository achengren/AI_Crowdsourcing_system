import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isGuest: (state) => state.user?.role === 'guest',
  },

  actions: {
    login(token, user) {
      localStorage.setItem('token', token)
      this.token = token
      this.user = user
    },

    loginAsGuest() {
      this.token = 'guest'
      this.user = { id: 'guest', name: '游客', role: 'guest' }
    },

    logout() {
      localStorage.removeItem('token')
      this.token = null
      this.user = null
    },
  },
})
