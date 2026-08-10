import { getWeekRange, one } from '../db.js'
import { DAILY_SUBMISSION_LIMIT, WEEKLY_SUBMISSION_LIMIT } from '../config.js'

export async function checkDailyLimit(userId) {
  const row = await one(
    'SELECT COUNT(1) AS count FROM submissions WHERE user_id = ? AND created_at >= CURRENT_DATE()',
    [userId]
  )
  return { exceeded: Number(row.count) >= DAILY_SUBMISSION_LIMIT, count: Number(row.count) }
}

export async function checkWeeklyLimit(userId) {
  const row = await one('SELECT COUNT(1) AS count FROM submissions WHERE user_id = ? AND created_at >= ?', [userId, getWeekRange()])
  return { exceeded: Number(row.count) >= WEEKLY_SUBMISSION_LIMIT, count: Number(row.count) }
}

export async function calculateStats(userId) {
  const weekStart = getWeekRange()
  const row = await one(
    `SELECT COUNT(1) AS total,
            SUM(CASE WHEN created_at >= CURRENT_DATE() THEN 1 ELSE 0 END) AS todayCount,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS weekCount,
            SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS publishedCount,
            SUM(CASE WHEN status = 'published' AND created_at >= ? THEN 1 ELSE 0 END) AS publishedWeekCount,
            SUM(CASE WHEN status = 'withdrawn' THEN 1 ELSE 0 END) AS withdrawnCount
     FROM submissions WHERE user_id = ?`,
    [weekStart, weekStart, userId]
  )
  return {
    total: Number(row.total || 0),
    todayCount: Number(row.todayCount || 0),
    weekCount: Number(row.weekCount || 0),
    publishedCount: Number(row.publishedCount || 0),
    publishedWeekCount: Number(row.publishedWeekCount || 0),
    withdrawnCount: Number(row.withdrawnCount || 0),
  }
}
