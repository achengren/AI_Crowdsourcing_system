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
  const row = await one(
    `SELECT COUNT(1) AS total,
            SUM(created_at >= CURRENT_DATE()) AS todayCount,
            SUM(created_at >= ?) AS weekCount,
            SUM(status = 'published') AS publishedCount,
            SUM(status = 'withdrawn') AS withdrawnCount
     FROM submissions WHERE user_id = ?`,
    [getWeekRange(), userId]
  )
  return {
    total: Number(row.total || 0),
    todayCount: Number(row.todayCount || 0),
    weekCount: Number(row.weekCount || 0),
    publishedCount: Number(row.publishedCount || 0),
    withdrawnCount: Number(row.withdrawnCount || 0),
  }
}
