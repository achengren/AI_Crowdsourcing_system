export function caseReviewError(status, rejectionReason) {
  if (status === 'rejected' && !String(rejectionReason || '').trim()) return '退回案例时必须填写原因'
  return null
}

export function canVoteOnAnnotation(userId, annotationAuthorId) {
  return Boolean(userId && annotationAuthorId && userId !== annotationAuthorId)
}

export function canWithdrawAnnotation(user, annotationAuthorId) {
  return Boolean(user && (user.role === 'admin' || user.id === annotationAuthorId))
}

export function canDeleteSubmissionVersion(revisionOfId, hasNewerRevision) {
  return !revisionOfId && !Boolean(Number(hasNewerRevision))
}

export function canPublishSubmissionVersion(hasNewerRevision) {
  return !Boolean(Number(hasNewerRevision))
}
