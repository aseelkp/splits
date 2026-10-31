import { describe, expect, it } from 'vitest'
import { daysBetween, dayAndDate, shortDate, todayIST, weekday } from './dates'
import { formatClock, pace, parseClock, toNumber } from './format'
import { parseShorthand } from './shorthand'
import {
  bestWeight,
  commonUnit,
  dueType,
  firstPrIndex,
  groupByExercise,
  groupBySession,
  lastByType,
  previousOfSameType,
  sessionPoints,
  totalsByUnit,
  unitsInUse,
} from './stats'

const set = (o) => ({ id: 1, session_id: 1, exercise_id: 1, exercise: 'Bench press', set_order: 1, weight: 60, unit: 'kg', reps: 10, is_warmup: false, date: '2026-10-01', ...o })

describe('parseShorthand (mirrors the backend)', () => {
  it('expands sets x reps and mixes', () => {
    expect(parseShorthand('40x10, 80x12, 90x2x10').sets).toEqual([
      { weight: 40, reps: 10 },
      { weight: 80, reps: 12 },
      { weight: 90, reps: 10 },
      { weight: 90, reps: 10 },
    ])
  })
  it('handles decimals, bodyweight, spacing and the times sign', () => {
    expect(parseShorthand('62.5x2x8').sets).toHaveLength(2)
    expect(parseShorthand('BW x 12').sets).toEqual([{ weight: null, reps: 12 }])
    expect(parseShorthand('30×2×10').sets).toHaveLength(2)
  })
  it('empty input is not an error', () => {
    expect(parseShorthand('  ')).toEqual({ sets: [], error: null })
  })
  it('names the bad token', () => {
    expect(parseShorthand('40x10, oops').error).toContain('"oops"')
  })
  it('rejects zero sets or reps', () => {
    expect(parseShorthand('30x0x10').error).toContain('at least 1')
    expect(parseShorthand('30x0').error).toContain('at least 1')
  })
})

describe('dates', () => {
  it('todayIST uses India, not the local zone', () => {
    // 20:00 UTC on the 30th is already 01:30 on the 31st in India
    expect(todayIST(new Date('2026-10-30T20:00:00Z'))).toBe('2026-10-31')
    expect(todayIST(new Date('2026-10-30T18:00:00Z'))).toBe('2026-10-30')
  })
  it('counts whole days', () => {
    expect(daysBetween('2026-10-18', '2026-10-31')).toBe(13)
    expect(daysBetween('2026-10-31', '2026-10-31')).toBe(0)
  })
  it('formats', () => {
    expect(shortDate('2026-10-31')).toBe('31 Oct')
    expect(weekday('2026-10-31')).toBe('Saturday')
    expect(dayAndDate('2026-10-31')).toBe('Sat 31 Oct')
  })
})

describe('format', () => {
  it('clock', () => {
    expect(formatClock(84)).toBe('1:24')
    expect(formatClock(1450)).toBe('24:10')
    expect(formatClock(-5)).toBe('0:00')
  })
  it('parseClock', () => {
    expect(parseClock('24:10')).toBe(1450)
    expect(parseClock('1:02:03')).toBe(3723)
    expect(parseClock('24')).toBe(1440)
    expect(parseClock('')).toBeNull()
    expect(parseClock('abc')).toBeNull()
    expect(parseClock('1:2:3:4')).toBeNull()
  })
  it('pace', () => {
    expect(pace(1450, 2.4)).toBe('10:04')
    expect(pace(null, 2.4)).toBeNull()
    expect(pace(1450, 0)).toBeNull()
  })
  it('toNumber', () => {
    expect(toNumber('2.4')).toBe(2.4)
    expect(toNumber('')).toBeNull()
    expect(toNumber('x')).toBeNull()
  })
})

describe('stats never mix units', () => {
  const history = [
    set({ id: 1, session_id: 1, date: '2026-10-01', weight: 60, unit: 'kg' }),
    set({ id: 2, session_id: 2, date: '2026-10-08', weight: 135, unit: 'lbs' }),
    set({ id: 3, session_id: 3, date: '2026-10-15', weight: 62.5, unit: 'kg' }),
    set({ id: 4, session_id: 3, date: '2026-10-15', weight: 100, unit: 'kg', is_warmup: true }),
  ]

  it('bestWeight is per unit and ignores warm-ups and the excluded session', () => {
    expect(bestWeight(history, 'kg')).toBe(62.5)
    expect(bestWeight(history, 'lbs')).toBe(135)
    expect(bestWeight(history, 'kg', 3)).toBe(60)
    expect(bestWeight([], 'kg')).toBeNull()
  })

  it('a heavier number in another unit is not a PR', () => {
    // 135 lbs > 62.5 kg as numbers, but they are different units
    expect(bestWeight(history, 'kg')).toBe(62.5)
  })

  it('sessionPoints: one per session, oldest first, one unit only', () => {
    expect(sessionPoints(history, 'kg').map((p) => [p.date, p.weight])).toEqual([['2026-10-01', 60], ['2026-10-15', 62.5]])
    expect(sessionPoints(history, 'lbs')).toHaveLength(1)
  })

  it('firstPrIndex is the first time the max was reached', () => {
    expect(firstPrIndex([{ weight: 55 }, { weight: 62.5 }, { weight: 62.5 }])).toBe(1)
    expect(firstPrIndex([])).toBe(-1)
  })

  it('unitsInUse lists the most recent unit first', () => {
    expect(unitsInUse(history)).toEqual(['kg', 'lbs'])
  })

  it('totals are kept per unit and skip warm-ups and bodyweight', () => {
    const sets = [
      set({ weight: 60, reps: 10, unit: 'kg' }),
      set({ weight: 135, reps: 5, unit: 'lbs' }),
      set({ weight: 100, reps: 5, unit: 'kg', is_warmup: true }),
      set({ weight: null, reps: 12, unit: 'kg' }),
    ]
    expect(totalsByUnit(sets)).toEqual({ kg: 600, lbs: 675 })
  })

  it('commonUnit picks the most used unit', () => {
    expect(commonUnit([set({ unit: 'lbs' }), set({ unit: 'lbs' }), set({ unit: 'kg' })])).toBe('lbs')
    expect(commonUnit([], 'lbs')).toBe('lbs')
  })
})

describe('session helpers', () => {
  it('groupBySession: newest first, sets in order', () => {
    const g = groupBySession([
      set({ id: 1, session_id: 1, date: '2026-10-01', set_order: 2 }),
      set({ id: 2, session_id: 1, date: '2026-10-01', set_order: 1 }),
      set({ id: 3, session_id: 2, date: '2026-10-08' }),
    ])
    expect(g.map((x) => x.sessionId)).toEqual([2, 1])
    expect(g[1].sets.map((s) => s.set_order)).toEqual([1, 2])
  })

  it('groupByExercise keeps first-appearance order', () => {
    const g = groupByExercise([set({ exercise: 'Row' }), set({ exercise: 'Bench press' }), set({ exercise: 'Row' })])
    expect(g.map((x) => [x.name, x.sets.length])).toEqual([['Row', 2], ['Bench press', 1]])
  })

  const sessions = [
    { id: 5, type: 'pull', date: '2026-10-25' },
    { id: 4, type: 'push', date: '2026-10-24' },
    { id: 3, type: 'push', date: '2026-10-17' },
    { id: 2, type: 'lower', date: '2026-10-20' },
  ]
  it('lastByType takes the newest of each', () => {
    const m = lastByType(sessions)
    expect(m.push.id).toBe(4)
    expect(m.lower.id).toBe(2)
    expect(m.run).toBeUndefined()
  })
  it('previousOfSameType finds the one before', () => {
    expect(previousOfSameType(sessions, sessions[1]).id).toBe(3)
    expect(previousOfSameType(sessions, sessions[2])).toBeNull()
  })
  it('dueType is the lifting type left longest, and null with no history', () => {
    const last = lastByType(sessions)
    const days = (d) => daysBetween(d, '2026-10-31')
    expect(dueType(last, days)).toBe('lower')
    expect(dueType({}, days)).toBeNull()
  })
})
