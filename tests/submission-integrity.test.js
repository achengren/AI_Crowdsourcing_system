import test from 'node:test'
import assert from 'node:assert/strict'
import { annotationIntegrityError, extractUserMessage, lockSubmissionToMessage } from '../server/services/submissionIntegrity.js'

test('message source overrides client supplied platform, model and answer', () => {
  const locked = lockSubmissionToMessage(
    { prompt: 'tampered', platform: 'fake', model: 'fake', aiAnswer: 'fake', images: [] },
    { platform: 'deepseek', model: 'configured-deepseek-model', aiAnswer: 'trusted answer' },
    '[image:/uploads/source.png]\ntrusted prompt'
  )
  assert.deepEqual(locked, {
    prompt: 'trusted prompt',
    platform: 'deepseek',
    model: 'configured-deepseek-model',
    aiAnswer: 'trusted answer',
    images: ['/uploads/source.png'],
  })
})

test('extractUserMessage handles messages without an image', () => {
  assert.deepEqual(extractUserMessage('plain prompt'), { prompt: 'plain prompt', imageUrl: '' })
})

test('annotation offsets must match the original answer', () => {
  const text = 'The answer contains an error.'
  assert.equal(annotationIntegrityError(text, [{ selectedText: 'answer', startOffset: 4, endOffset: 10 }]), null)
  assert.match(annotationIntegrityError(text, [{ selectedText: 'wrong', startOffset: 4, endOffset: 10 }]), /不一致/)
})

test('annotations may not overlap', () => {
  const error = annotationIntegrityError('abcdefghij', [
    { selectedText: 'abcde', startOffset: 0, endOffset: 5 },
    { selectedText: 'def', startOffset: 3, endOffset: 6 },
  ])
  assert.match(error, /不能互相重叠/)
})
