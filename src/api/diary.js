import client from './client'

export const getDiaries = params => client.get('/diaries', { params })
export const createDiary = data => client.post('/diaries', data)
export const updateDiary = (id, data) => client.put(`/diaries/${id}`, data)
export const deleteDiary = id => client.delete(`/diaries/${id}`)
