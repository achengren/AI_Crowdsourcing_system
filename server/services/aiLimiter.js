const MAX_GLOBAL = Number(process.env.AI_MAX_CONCURRENCY || 25)
const MAX_PER_USER = Number(process.env.AI_MAX_PER_USER || 2)

let globalActive = 0
const activeByUser = new Map()

export function acquireAiSlot(userId) {
  const userActive = activeByUser.get(userId) || 0
  if (globalActive >= MAX_GLOBAL || userActive >= MAX_PER_USER) return false
  globalActive += 1
  activeByUser.set(userId, userActive + 1)
  return true
}

export function releaseAiSlot(userId) {
  globalActive = Math.max(0, globalActive - 1)
  const next = Math.max(0, (activeByUser.get(userId) || 1) - 1)
  if (next) activeByUser.set(userId, next)
  else activeByUser.delete(userId)
}

export function getAiLoad() {
  return { active: globalActive, limit: MAX_GLOBAL }
}
