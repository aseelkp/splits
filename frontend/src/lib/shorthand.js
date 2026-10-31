// Live preview of gym shorthand. This mirrors backend/app/services/shorthand.py so the preview shows
// what will be saved. The backend stays the authority: the app sends the raw text and the server parses it.

export const EXAMPLES = '"35x10", "30x2x10", "40x10, 80x12, 90x2x10", "bwx12"'

const TOKEN = /^(bw|\d+(?:\.\d+)?)\s*[x×]\s*(\d+)(?:\s*[x×]\s*(\d+))?$/i

/** "40x10, 62.5x2x8" -> { sets: [{ weight: 40, reps: 10 }, ...], error: null }. Weight null = bodyweight. */
export function parseShorthand(text) {
  const tokens = text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length === 0) return { sets: [], error: null }

  const sets = []
  for (const token of tokens) {
    const m = TOKEN.exec(token)
    if (!m) {
      return { sets: [], error: `Could not read "${token}". Use weight x reps or weight x sets x reps. Examples: ${EXAMPLES}.` }
    }
    const weight = m[1].toLowerCase() === 'bw' ? null : Number(m[1])
    const count = m[3] === undefined ? 1 : Number(m[2])
    const reps = m[3] === undefined ? Number(m[2]) : Number(m[3])
    if (count < 1 || reps < 1) return { sets: [], error: `"${token}": sets and reps must be at least 1.` }
    for (let i = 0; i < count; i++) sets.push({ weight, reps })
  }
  return { sets, error: null }
}
