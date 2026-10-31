import { formatWeight, plateColor, plateRank, UNITS } from '../lib/units'

// A barbell drawn with the plates on one side, mirrored to the other. The tallest plate is the
// heaviest. New plates (more than last time) get an accent outline.

const HEIGHT = [100, 76, 58, 46, 36, 30]
const WIDTH = [14, 12, 10, 9, 8, 7]
const CENTER = 175
const COLLAR_X = 106

export default function Bar({ plates, flags = [], unit }) {
  const ranks = plates.map((p) => Math.max(0, plateRank(p, unit)))
  const total = ranks.reduce((sum, r) => sum + WIDTH[r] + 2, 0)
  const scale = Math.min(1, 92 / Math.max(total, 1))

  let cursor = COLLAR_X - 2
  const drawn = plates.map((plate, i) => {
    const w = WIDTH[ranks[i]] * scale
    const h = HEIGHT[ranks[i]]
    const x = cursor - w
    cursor = x - 2 * scale
    return { plate, x, w, h, isNew: flags[i], color: plateColor(plate, unit) }
  })

  const newOnes = drawn.filter((d) => d.isNew).map((d) => formatWeight(d.plate))
  const label = plates.length
    ? `Barbell with ${plates.map(formatWeight).join(', ')} ${unit} on each side.` + (newOnes.length ? ` New since last time: ${newOnes.join(', ')}.` : '')
    : `Empty ${UNITS[unit].bar} ${unit} bar.`

  return (
    <svg role="img" aria-label={label} width="100%" viewBox="0 0 350 108" style={{ display: 'block', maxWidth: 350 }}>
      <rect x="0" y="50" width="350" height="8" rx="3" fill="var(--muted)" />
      <rect x="136" y="50" width="78" height="8" fill="var(--fg)" opacity="0.5" />
      <rect x={COLLAR_X} y="42" width="7" height="24" rx="2" fill="var(--fg)" />
      <rect x={2 * CENTER - COLLAR_X - 7} y="42" width="7" height="24" rx="2" fill="var(--fg)" />
      {drawn.map((d, i) => {
        const y = 54 - d.h / 2
        const common = { y, width: d.w, height: d.h, rx: Math.min(5, d.w / 2), fill: `var(--plate-${d.color})`, stroke: d.isNew ? 'var(--accent)' : 'var(--edge)', strokeWidth: d.isNew ? 3 : 2 }
        return (
          <g key={i}>
            <rect {...common} x={d.x} />
            <rect {...common} x={2 * CENTER - d.x - d.w} />
          </g>
        )
      })}
    </svg>
  )
}
