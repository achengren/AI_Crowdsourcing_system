const COURSE_TIME_ZONE = 'Asia/Shanghai'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: COURSE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function getCourseDateTime(now = new Date()) {
  const parts = Object.fromEntries(
    formatter.formatToParts(now)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

export function validateDiaryTiming({ logDate, occurredAt }, now = new Date()) {
  const current = getCourseDateTime(now)
  if (!DATE_PATTERN.test(String(logDate || '')) || logDate !== current.date) {
    return '每日信息需求记录仅支持当天填写，不能补交或提前填写'
  }
  if (occurredAt != null && occurredAt !== '') {
    if (!TIME_PATTERN.test(occurredAt)) return '发生时间格式无效'
    if (occurredAt > current.time) return '发生时间不能晚于当前时间'
  }
  return ''
}

export function isCurrentCourseDate(logDate, now = new Date()) {
  return logDate === getCourseDateTime(now).date
}
