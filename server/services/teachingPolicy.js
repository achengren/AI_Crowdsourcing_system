export function caseModerationError(status, reason) {
  if (status === 'withdrawn' && !String(reason || '').trim()) return '撤回案例时必须填写原因'
  return null
}

// Kept for compatibility with legacy tests and previously reviewed records.
export function caseReviewError(status, reason) {
  if (status === 'rejected' && !String(reason || '').trim()) return '退回案例时必须填写原因'
  return caseModerationError(status, reason)
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
