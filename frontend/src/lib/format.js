/** 84 -> "1:24", 1450 -> "24:10" */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "24:10" -> 1450, "1:02:03" -> 3723, "24" -> 1440 (a bare number is minutes). Anything else: null. */
export function parseClock(text) {
  const t = String(text ?? '').trim()
  if (!t) return null
  const parts = t.split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  const n = parts.map(Number)
  if (n.length === 1) return n[0] * 60
  if (n.length === 2) return n[0] * 60 + n[1]
  return n[0] * 3600 + n[1] * 60 + n[2]
}

/** Pace per km as "m:ss", or null when time or distance is missing. */
export function pace(seconds, km) {
  if (!seconds || !km || km <= 0) return null
  return formatClock(seconds / km)
}

/** "" -> null, "2.4" -> 2.4, "abc" -> null. For optional number fields. */
export function toNumber(text) {
  const t = String(text ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** 4961 -> "4,961" */
export const thousands = (n) => Math.round(n).toLocaleString('en-US')
