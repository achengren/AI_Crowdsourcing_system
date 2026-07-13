import { getDb, getWeekRange } from '../db.js'
import { DAILY_SUBMISSION_LIMIT, WEEKLY_SUBMISSION_LIMIT } from '../config.js'

export function checkDailyLimit(userId) {
  const today = new Date().toISOString().slice(0, 10)
  const row = getDb().exec(
    "SELECT COUNT(*) FROM submissions WHERE user_id = ? AND created_at >= ?",
    [userId, today]
  )
  const count = row[0].values[0][0]
  return { exceeded: count >= DAILY_SUBMISSION_LIMIT, count }
}

export function checkWeeklyLimit(userId) {
  const weekStart = getWeekRange()
  const row = getDb().exec(
    "SELECT COUNT(*) FROM submissions WHERE user_id = ? AND created_at >= ?",
    [userId, weekStart]
  )
  const count = row[0].values[0][0]
  return { exceeded: count >= WEEKLY_SUBMISSION_LIMIT, count }
}

export function calculateStats(userId) {
  const today = new Date().toISOString().slice(0, 10)
  const weekStart = getWeekRange()

  const row = getDb().exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today_count,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as week_count,
      SUM(CASE WHEN is_good_case = 1 THEN 1 ELSE 0 END) as good_cases,
      ROUND(AVG(satisfaction), 1) as avg_satisfaction
    FROM submissions WHERE user_id = ?
  `, [today, weekStart, userId])

  if (row[0] && row[0].values.length) {
    const v = row[0].values[0]
    return { total: v[0], todayCount: v[1], weekCount: v[2], goodCases: v[3], avgSatisfaction: v[4] || 0 }
  }
  return { total: 0, todayCount: 0, weekCount: 0, goodCases: 0, avgSatisfaction: 0 }
}
