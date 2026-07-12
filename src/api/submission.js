import client from './client'

export function submitCase(data) {
  return client.post('/submissions', data)
}

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

export function parseLink(url) {
  return client.post('/parse-link', { url })
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
