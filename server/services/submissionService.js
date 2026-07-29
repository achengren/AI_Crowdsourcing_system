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
            SUM(is_good_case = 1) AS goodCases,
            ROUND(AVG(satisfaction), 1) AS avgSatisfaction
     FROM submissions WHERE user_id = ?`,
    [getWeekRange(), userId]
  )
  return {
    total: Number(row.total || 0),
    todayCount: Number(row.todayCount || 0),
    weekCount: Number(row.weekCount || 0),
    goodCases: Number(row.goodCases || 0),
    avgSatisfaction: Number(row.avgSatisfaction || 0),
  }
}
