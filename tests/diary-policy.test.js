import test from 'node:test'
import assert from 'node:assert/strict'
import { getCourseDateTime, isCurrentCourseDate, validateDiaryTiming } from '../server/services/diaryPolicy.js'

const beijingAfternoon = new Date('2026-08-14T07:30:00.000Z')

test('course date and time are derived in Asia/Shanghai', () => {
  assert.deepEqual(getCourseDateTime(beijingAfternoon), { date: '2026-08-14', time: '15:30' })
  assert.equal(isCurrentCourseDate('2026-08-14', beijingAfternoon), true)
  assert.equal(isCurrentCourseDate('2026-08-13', beijingAfternoon), false)
})

test('diary timing only accepts the current course date and elapsed time', () => {
  assert.equal(validateDiaryTiming({ logDate: '2026-08-14', occurredAt: '15:30' }, beijingAfternoon), '')
  assert.equal(validateDiaryTiming({ logDate: '2026-08-14', occurredAt: '08:05' }, beijingAfternoon), '')
  assert.match(validateDiaryTiming({ logDate: '2026-08-13', occurredAt: '12:00' }, beijingAfternoon), /不能补交/)
  assert.match(validateDiaryTiming({ logDate: '2026-08-15', occurredAt: '12:00' }, beijingAfternoon), /不能补交/)
  assert.match(validateDiaryTiming({ logDate: '2026-08-14', occurredAt: '15:31' }, beijingAfternoon), /不能晚于当前时间/)
  assert.match(validateDiaryTiming({ logDate: '2026-08-14', occurredAt: '25:00' }, beijingAfternoon), /格式无效/)
})

test('course date remains correct around UTC day boundaries', () => {
  assert.deepEqual(getCourseDateTime(new Date('2026-08-13T16:01:00.000Z')), { date: '2026-08-14', time: '00:01' })
})
