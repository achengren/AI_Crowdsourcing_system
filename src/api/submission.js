import client from './client'

export function submitCase(data) {
  return client.post('/submissions', data)
}

export const getCaseDraftFromMessage = id => client.get(`/submissions/draft/from-message/${id}`)
export const getCaseDraftFromDiary = id => client.get(`/submissions/draft/from-diary/${id}`)
export const getCaseDraftFromRevision = id => client.get(`/submissions/draft/from-revision/${id}`)

export function getMySubmissions(params) {
  return client.get('/submissions/my', { params })
}

export function getCases(params) {
  return client.get('/cases', { params })
}

export function likeCase(id) {
  return client.post(`/cases/${id}/like`)
}

export function getComments(caseId) {
  return client.get(`/cases/${caseId}/comments`)
}

export function addComment(caseId, data) {
  return client.post(`/cases/${caseId}/comments`, data)
}

export const addCaseAnnotation = (caseId, data) => client.post(`/cases/${caseId}/annotations`, data)
export const voteCaseAnnotation = (caseId, annotationId, vote) => client.post(`/cases/${caseId}/annotations/${annotationId}/vote`, { vote })
export const withdrawCaseAnnotation = (caseId, annotationId) => client.delete(`/cases/${caseId}/annotations/${annotationId}`)
export const getAnnotationComments = (caseId, annotationId) => client.get(`/cases/${caseId}/annotations/${annotationId}/comments`)
export const addAnnotationComment = (caseId, annotationId, data) => client.post(`/cases/${caseId}/annotations/${annotationId}/comments`, data)
export const updateAnnotationComment = (caseId, annotationId, commentId, data) => client.put(`/cases/${caseId}/annotations/${annotationId}/comments/${commentId}`, data)
export const deleteAnnotationComment = (caseId, annotationId, commentId) => client.delete(`/cases/${caseId}/annotations/${annotationId}/comments/${commentId}`)

export function parseLink(url) {
  return client.post('/parse-link', { url })
}

export const importConversationText = data => client.post('/submissions/import-text', data)

export function importConversationScreenshots(files, platform = '') {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file.originFileObj || file))
  if (platform) formData.append('platform', platform)
  return client.post('/submissions/import-screenshots', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  })
}

export function deleteSubmission(id) {
  return client.delete(`/submissions/${id}`)
}

export function uploadImage(file) {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
