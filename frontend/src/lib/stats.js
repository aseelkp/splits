// Numbers derived from history. Units are never mixed: every comparison is within one unit,
// and totals are kept per unit.

const working = (s) => !s.is_warmup && s.weight != null

/** Heaviest working set in `unit`, optionally ignoring one session. null when there is none. */
export function bestWeight(history, unit, excludeSessionId = null) {
  let best = null
  for (const s of history) {
    if (s.unit !== unit || !working(s) || s.session_id === excludeSessionId) continue
    if (best === null || s.weight > best) best = s.weight
  }
  return best
}

/** One point per session: its heaviest working set in `unit`. Oldest first. */
export function sessionPoints(history, unit) {
  const bySession = new Map()
  for (const s of history) {
    if (s.unit !== unit || !working(s)) continue
    const cur = bySession.get(s.session_id)
    if (!cur || s.weight > cur.weight) bySession.set(s.session_id, { sessionId: s.session_id, date: s.date, weight: s.weight })
  }
  return [...bySession.values()].sort((a, b) => (a.date === b.date ? a.sessionId - b.sessionId : a.date < b.date ? -1 : 1))
}

/** Index of the first point that reached the highest weight (the PR). -1 when empty. */
export function firstPrIndex(points) {
  if (points.length === 0) return -1
  const max = Math.max(...points.map((p) => p.weight))
  return points.findIndex((p) => p.weight === max)
}

/** Sets grouped by session, newest first, each group in set order. */
export function groupBySession(history) {
  const groups = new Map()
  for (const s of history) {
    if (!groups.has(s.session_id)) groups.set(s.session_id, { sessionId: s.session_id, date: s.date, sets: [] })
    groups.get(s.session_id).sets.push(s)
  }
  const list = [...groups.values()]
  for (const g of list) g.sets.sort((a, b) => a.set_order - b.set_order)
  return list.sort((a, b) => (a.date === b.date ? b.sessionId - a.sessionId : a.date < b.date ? 1 : -1))
}

/** Which units appear in the history, most recent first. */
export function unitsInUse(history) {
  const seen = []
  for (const s of [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))) {
    if (!seen.includes(s.unit)) seen.push(s.unit)
  }
  return seen
}

/** Total weight x reps of working sets, per unit: { kg: 1925, lbs: 800 }. Never adds across units. */
export function totalsByUnit(sets) {
  const totals = {}
  for (const s of sets) {
    if (!working(s) || s.reps == null) continue
    totals[s.unit] = (totals[s.unit] ?? 0) + s.weight * s.reps
  }
  return totals
}

/** A session's sets grouped by exercise, in order of first appearance. */
export function groupByExercise(sets) {
  const groups = new Map()
  for (const s of sets) {
    if (!groups.has(s.exercise)) groups.set(s.exercise, { name: s.exercise, exerciseId: s.exercise_id, sets: [] })
    groups.get(s.exercise).sets.push(s)
  }
  return [...groups.values()]
}

/** The unit used most among these sets (ties: the first seen). Falls back to `fallback`. */
export function commonUnit(sets, fallback = 'kg') {
  const counts = {}
  for (const s of sets) counts[s.unit] = (counts[s.unit] ?? 0) + 1
  let best = fallback
  let n = 0
  for (const [u, c] of Object.entries(counts)) if (c > n) [best, n] = [u, c]
  return best
}

/** Newest session of each type. `sessions` must be newest first, as the API returns them. */
export function lastByType(sessions) {
  const map = {}
  for (const s of sessions) if (!map[s.type]) map[s.type] = s
  return map
}

/** The session of the same type just before `current`, or null. */
export function previousOfSameType(sessions, current) {
  return sessions.find((s) => s.type === current.type && s.id !== current.id && (s.date < current.date || (s.date === current.date && s.id < current.id))) ?? null
}

const ROTATION = ['push', 'pull', 'lower', 'upper']

/** The lifting type you have left longest (only types you have done before). null when there is no history. */
export function dueType(last, daysSince) {
  let due = null
  let most = -1
  for (const type of ROTATION) {
    if (!last[type]) continue
    const d = daysSince(last[type].date)
    if (d > most) [due, most] = [type, d]
  }
  return due
}
