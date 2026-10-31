// All dates are Asia/Kolkata calendar dates, as plain "YYYY-MM-DD" strings (what the API uses).

export const TIME_ZONE = 'Asia/Kolkata'

/** Today's date in India, whatever timezone the phone thinks it is in. */
export function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

const utc = (s) => new Date(`${s}T00:00:00Z`)

/** Whole days from date a to date b (b minus a). */
export function daysBetween(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000)
}

/** "2026-10-31" -> "31 Oct" */
export function shortDate(s) {
  return utc(s).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
}

/** "2026-10-31" -> "Saturday" */
export function weekday(s) {
  return utc(s).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long' })
}

/** "2026-10-31" -> "Sat 31 Oct" */
export function dayAndDate(s) {
  return utc(s).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')
}
