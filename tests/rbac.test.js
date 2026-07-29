import test from 'node:test'
import assert from 'node:assert/strict'
import { requireAdmin } from '../server/middleware.js'

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('requireAdmin allows administrators', () => {
  const response = responseRecorder()
  let called = false
  requireAdmin({ user: { role: 'admin' } }, response, () => { called = true })
  assert.equal(called, true)
  assert.equal(response.statusCode, 200)
})

test('requireAdmin rejects students', () => {
  const response = responseRecorder()
  let called = false
  requireAdmin({ user: { role: 'student' } }, response, () => { called = true })
  assert.equal(called, false)
  assert.equal(response.statusCode, 403)
})
