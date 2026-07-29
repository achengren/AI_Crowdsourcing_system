import client from './client'

export const getAdminOverview = () => client.get('/admin/overview')
export const getAdminUsers = params => client.get('/admin/users', { params })
export const createAdminUser = data => client.post('/admin/users', data)
export const updateAdminUser = (id, data) => client.put(`/admin/users/${id}`, data)
export const disableAdminUser = id => client.delete(`/admin/users/${id}`)
export const resetAdminUserPassword = (id, password) => client.post(`/admin/users/${id}/reset-password`, { password })
export const importAdminUsers = file => {
  const data = new FormData()
  data.append('file', file)
  return client.post('/admin/users/import', data, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const getAdminConversations = params => client.get('/admin/conversations', { params })
export const getAdminMessages = id => client.get(`/admin/conversations/${id}/messages`)
export const getAdminCases = params => client.get('/admin/cases', { params })
export const getAdminCase = id => client.get(`/admin/cases/${id}`)
export const updateAdminCaseStatus = (id, status, rejectionReason = '') => client.put(`/admin/cases/${id}/status`, { status, rejectionReason })
export const getAdminDiaries = params => client.get('/admin/diaries', { params })
export const getAdminDiaryCompletion = date => client.get('/admin/diaries/completion', { params: { date } })
export const getAdminDiary = id => client.get(`/admin/diaries/${id}`)

export async function exportAdminData(type) {
  const response = await fetch(`/api/admin/export?type=${encodeURIComponent(type)}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  if (!response.ok) throw new Error('导出失败')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${type}-${new Date().toISOString().slice(0, 10)}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}
