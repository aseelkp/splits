import { describe, expect, it } from 'vitest'
import { addPlate, formatWeight, newPlateFlags, plateColor, platesPerSide, removePlate, UNITS } from './units'

describe('platesPerSide', () => {
  it('kg: 62.5 is a 20 kg bar plus 20 and 1.25 each side', () => {
    expect(platesPerSide(62.5, 'kg')).toEqual({ plates: [20, 1.25], leftover: 0, underBar: false })
  })

  it('kg: the empty bar has no plates', () => {
    expect(platesPerSide(20, 'kg').plates).toEqual([])
  })

  it('lbs: 135 is the 45 lb bar plus one 45 each side', () => {
    expect(platesPerSide(135, 'lbs')).toEqual({ plates: [45], leftover: 0, underBar: false })
  })

  it('lbs: 225 is the bar plus two 45s each side', () => {
    expect(platesPerSide(225, 'lbs').plates).toEqual([45, 45])
  })

  it('lbs: 185 is 45 + 25 each side', () => {
    expect(platesPerSide(185, 'lbs').plates).toEqual([45, 25])
  })

  it('lbs: 100 is 27.5 a side, made of 25 + 2.5', () => {
    expect(platesPerSide(100, 'lbs').plates).toEqual([25, 2.5])
  })

  it('the same number gives different plates in each unit (no conversion)', () => {
    expect(platesPerSide(100, 'kg').plates).toEqual([20, 20])
    expect(platesPerSide(100, 'lbs').plates).toEqual([25, 2.5])
  })

  it('reports what plates cannot make', () => {
    // 21 kg: 0.5 kg per side is smaller than the smallest plate
    const r = platesPerSide(21, 'kg')
    expect(r.plates).toEqual([])
    expect(r.leftover).toBe(1)
  })

  it('lighter than the bar is flagged, zero and null are not', () => {
    expect(platesPerSide(10, 'kg').underBar).toBe(true)
    expect(platesPerSide(0, 'kg').underBar).toBe(false)
    expect(platesPerSide(null, 'lbs').underBar).toBe(false)
  })

  it('small plates add up exactly (no float drift)', () => {
    // 20 kg bar + 2 * (2.5 + 1.25) = 27.5 kg
    expect(platesPerSide(27.5, 'kg')).toEqual({ plates: [2.5, 1.25], leftover: 0, underBar: false })
  })
})

describe('addPlate / removePlate', () => {
  it('adds a pair of plates', () => {
    expect(addPlate(60, 1.25, 'kg')).toBe(62.5)
    expect(addPlate(135, 10, 'lbs')).toBe(155)
  })

  it('starts from the empty bar when lighter than the bar or empty', () => {
    expect(addPlate(0, 20, 'kg')).toBe(60)
    expect(addPlate(null, 45, 'lbs')).toBe(135)
    expect(addPlate(10, 5, 'kg')).toBe(30)
  })

  it('removes the lightest plate pair', () => {
    expect(removePlate(62.5, 'kg')).toBe(60)
    expect(removePlate(155, 'lbs')).toBe(135)
  })

  it('does nothing with no plates on', () => {
    expect(removePlate(20, 'kg')).toBe(20)
    expect(removePlate(45, 'lbs')).toBe(45)
    expect(removePlate(0, 'kg')).toBe(0)
  })

  it('removes the lightest plate of the current view, which can differ from what was added', () => {
    // 100 lb is 25 + 2.5 a side. Add a 2.5 and the view merges to 25 + 5, so "lightest" is the 5.
    // The UI therefore keeps its own undo stack of plates actually added (see Session screen).
    expect(removePlate(addPlate(100, 2.5, 'lbs'), 'lbs')).toBe(95)
  })
})

describe('newPlateFlags', () => {
  it('marks only the extra plates as new', () => {
    expect(newPlateFlags([20, 1.25], [20])).toEqual([false, true])
    expect(newPlateFlags([20, 20, 1.25], [20, 20])).toEqual([false, false, true])
  })

  it('marks everything new when there was nothing last time', () => {
    expect(newPlateFlags([20, 10], [])).toEqual([true, true])
  })

  it('marks nothing when it matches, or when it is lighter', () => {
    expect(newPlateFlags([20], [20])).toEqual([false])
    expect(newPlateFlags([20], [20, 5])).toEqual([false])
  })
})

describe('formatWeight', () => {
  it('trims trailing zeros', () => {
    expect(formatWeight(62.5)).toBe('62.5')
    expect(formatWeight(60)).toBe('60')
    expect(formatWeight(1.25)).toBe('1.25')
    expect(formatWeight(null)).toBe('0')
  })
})

describe('plateColor', () => {
  it('every plate in both units has a colour, and heavier plates differ from lighter ones', () => {
    for (const unit of Object.keys(UNITS)) {
      const colours = UNITS[unit].plates.map((p) => plateColor(p, unit))
      expect(new Set(colours).size).toBe(colours.length)
    }
  })
})
