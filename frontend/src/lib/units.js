// Weight units. kg and lbs are both first-class and are NEVER converted into each other:
// the number you typed, in the unit you typed it, is what gets stored.
//
// The plate loader is only a view of that number: weight = bar + 2 * (plates on one side).

export const UNITS = {
  kg: { label: 'kg', bar: 20, plates: [20, 10, 5, 2.5, 1.25] },
  lbs: { label: 'lbs', bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
}

export const UNIT_NAMES = Object.keys(UNITS)

// Work in hundredths so 1.25 + 1.25 never turns into 2.5000000000000004.
const h = (n) => Math.round(n * 100)
export const round2 = (n) => Math.round(n * 100) / 100

/** "62.5", "60", "1.25": no trailing zeros. */
export function formatWeight(w) {
  if (w == null || Number.isNaN(w)) return '0'
  return String(round2(w))
}

/**
 * Which plates, per side, make up this weight on a barbell?
 * Greedy from the heaviest plate. `leftover` is what plates cannot make (dumbbells, machines,
 * odd weights); `underBar` means the weight is lighter than the empty bar.
 */
export function platesPerSide(weight, unit) {
  const { bar, plates } = UNITS[unit]
  const total = h(weight ?? 0)
  if (total < h(bar)) return { plates: [], leftover: 0, underBar: total > 0 }
  let remaining = (total - h(bar)) / 2
  const out = []
  for (const p of plates) {
    while (remaining >= h(p)) {
      out.push(p)
      remaining -= h(p)
    }
  }
  return { plates: out, leftover: round2(remaining / 100) * 2, underBar: false }
}

/** Weight after adding one plate to each side. Below the bar, start from the empty bar. */
export function addPlate(weight, plate, unit) {
  const base = Math.max(weight ?? 0, UNITS[unit].bar)
  return round2(base + 2 * plate)
}

/** Weight after taking the lightest plate off each side. No plates on: unchanged. */
export function removePlate(weight, unit) {
  const { plates } = platesPerSide(weight, unit)
  if (plates.length === 0) return weight ?? 0
  return round2(weight - 2 * plates[plates.length - 1])
}

/**
 * For each plate in `current`, is it new compared with `last`? Plates are matched like
 * a multiset, so 20+20+1.25 against 20+20 marks only the 1.25 as new.
 */
export function newPlateFlags(current, last) {
  const pool = [...last]
  return current.map((p) => {
    const i = pool.indexOf(p)
    if (i === -1) return true
    pool.splice(i, 1)
    return false
  })
}

/** Index of a plate within its unit's set: 0 is the heaviest. Used for colour and size. */
export const plateRank = (plate, unit) => UNITS[unit].plates.indexOf(plate)

// Plate colours by rank (0 = heaviest), per unit. lbs has six plates, kg has five.
// Colour is only a hint: every plate also shows its number and has a distinct size.
const PLATE_COLORS = {
  kg: ['blue', 'green', 'white', 'red', 'silver'],
  lbs: ['blue', 'yellow', 'green', 'white', 'red', 'silver'],
}

export const plateColor = (plate, unit) => PLATE_COLORS[unit][plateRank(plate, unit)] ?? 'silver'
