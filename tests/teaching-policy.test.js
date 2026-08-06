import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canDeleteSubmissionVersion,
  canPublishSubmissionVersion,
  canVoteOnAnnotation,
  canWithdrawAnnotation,
  caseModerationError,
  caseReviewError,
} from '../server/services/teachingPolicy.js'

test('rejecting a case requires a reason', () => {
  assert.equal(caseReviewError('rejected', '  '), '退回案例时必须填写原因')
  assert.equal(caseReviewError('rejected', '请补充证据'), null)
  assert.equal(caseReviewError('published', ''), null)
})

test('withdrawing a published case requires an administrator reason', () => {
  assert.equal(caseModerationError('withdrawn', ''), '撤回案例时必须填写原因')
  assert.equal(caseModerationError('withdrawn', '包含个人信息'), null)
  assert.equal(caseModerationError('published', ''), null)
})

test('annotation authors cannot vote on their own annotation', () => {
  assert.equal(canVoteOnAnnotation('student-a', 'student-a'), false)
  assert.equal(canVoteOnAnnotation('student-b', 'student-a'), true)
})

test('annotation withdrawal is limited to its author or an administrator', () => {
  assert.equal(canWithdrawAnnotation({ id: 'student-a', role: 'student' }, 'student-a'), true)
  assert.equal(canWithdrawAnnotation({ id: 'student-b', role: 'student' }, 'student-a'), false)
  assert.equal(canWithdrawAnnotation({ id: 'admin', role: 'admin' }, 'student-a'), true)
})

test('version history prevents deleting linked cases or publishing superseded cases', () => {
  assert.equal(canDeleteSubmissionVersion(null, 0), true)
  assert.equal(canDeleteSubmissionVersion('previous-id', 0), false)
  assert.equal(canDeleteSubmissionVersion(null, 1), false)
  assert.equal(canPublishSubmissionVersion(0), true)
  assert.equal(canPublishSubmissionVersion(1), false)
})
