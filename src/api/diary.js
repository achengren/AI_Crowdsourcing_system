import client from './client'

export const getDiaries = params => client.get('/diaries', { params })
export const getDiary = id => client.get(`/diaries/${id}`)
export const getDiaryDraftFromMessage = id => client.get(`/diaries/draft/from-message/${id}`)
export const getDiaryDraftFromCase = id => client.get(`/diaries/draft/from-case/${id}`)
export const createDiary = data => client.post('/diaries', data)
export const updateDiary = (id, data) => client.put(`/diaries/${id}`, data)
export const deleteDiary = id => client.delete(`/diaries/${id}`)
