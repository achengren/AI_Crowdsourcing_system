import axios from 'axios'
import { message } from 'ant-design-vue'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message || '请求失败，请稍后重试'
    if (err.response?.status === 401) {
      const isLoginRequest = err.config?.url === '/auth/login'
      if (!isLoginRequest) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return Promise.reject(err)
      }
    }
    message.error(msg)
    return Promise.reject(err)
  }
)

export default client
