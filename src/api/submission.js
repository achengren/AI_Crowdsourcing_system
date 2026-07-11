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
