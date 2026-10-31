import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import { bestWeight, commonUnit, groupByExercise } from '../lib/stats'
import { draft, patchDraft, patchExercise } from '../store/draft'
import { settings } from '../store/settings'

// Everything about the session you are logging right now.
//
// Two places hold data on purpose:
//   - the server holds every set you have LOGGED (the source of truth)
//   - the draft (localStorage) holds what is not saved yet: numbers on screen, which exercise is
//     open, the rest timer. It is written on every change, so closing the app loses nothing.

const Ctx = createContext(null)
export const useSession = () => useContext(Ctx)

const working = (s) => !s.is_warmup

/** Build the draft's exercise list from last time's session of the same type. */
function exercisesFromLast(last) {
  if (!last) return []
  return groupByExercise(last.sets).map((g) => {
    const sets = g.sets.filter(working)
    const lastSets = sets.map((s) => ({ weight: s.weight, unit: s.unit, reps: s.reps ?? 0 }))
    const unit = commonUnit(sets.length ? sets : g.sets)
    const first = lastSets.find((s) => s.unit === unit) ?? lastSets[0]
    return { name: g.name, unit, weight: first?.weight ?? 0, reps: 0, warmup: false, plateStack: [], lastSets, lastDate: last.date }
  })
}

const messageOf = (e) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.')

export function SessionProvider({ children }) {
  const d = draft.use()
  const [session, setSession] = useState(null)
  const [bests, setBests] = useState({}) // exercise name -> { kg: 62.5, lbs: 135 }, history before this session
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const exerciseIds = useRef(null) // lower-case name -> id, loaded once

  const sessionId = d?.sessionId ?? null

  // Load the saved session (sets already logged) when there is a draft with a session id.
  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      return
    }
    if (session?.id === sessionId) return
    let cancelled = false
    api.sessions
      .get(sessionId)
      .then((s) => !cancelled && setSession(s))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) patchDraft({ sessionId: null }) // deleted elsewhere
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, session?.id])

  const idFor = useCallback(async (name) => {
    if (!exerciseIds.current) {
      const list = await api.exercises.list()
      exerciseIds.current = new Map(list.map((e) => [e.name.toLowerCase(), e]))
    }
    return exerciseIds.current.get(name.toLowerCase()) ?? null
  }, [])

  // For each exercise in the draft, load the heaviest set per unit from before today (to spot PRs).
  const namesKey = (d?.exercises ?? []).map((e) => e.name).join('|')
  useEffect(() => {
    if (!d) return
    let cancelled = false
    ;(async () => {
      for (const ex of d.exercises) {
        if (bests[ex.name]) continue
        try {
          const found = await idFor(ex.name)
          const history = found ? await api.exercises.history(found.id, 500) : []
          const value = { kg: bestWeight(history, 'kg', d.sessionId), lbs: bestWeight(history, 'lbs', d.sessionId) }
          if (!cancelled) setBests((b) => ({ ...b, [ex.name]: value }))
        } catch {
          /* PR detection is a nice-to-have; logging must not depend on it */
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey, d?.sessionId])

  const startSession = useCallback(async (type) => {
    setError('')
    setBusy(true)
    try {
      const last = await api.sessions.last(type)
      draft.set({ type, sessionId: null, active: 0, exercises: exercisesFromLast(last), rest: null, startedAt: Date.now() })
      setSession(null)
      setBests({})
      return true
    } catch (e) {
      setError(messageOf(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  /** Create the session on the server if this is the first thing saved. Returns its id. */
  const ensureSession = useCallback(async (extra = {}) => {
    const cur = draft.get()
    if (cur.sessionId) return { id: cur.sessionId, result: null }
    const result = await api.sessions.create({ type: cur.type, sets: [], ...extra })
    patchDraft({ sessionId: result.session.id })
    setSession(result.session)
    return { id: result.session.id, result }
  }, [])

  const logSet = useCallback(async () => {
    const cur = draft.get()
    const ex = cur.exercises[cur.active]
    if (!ex) return false
    if (!(ex.reps > 0)) {
      setError('Count at least 1 rep first.')
      return false
    }
    setError('')
    setBusy(true)
    try {
      const payload = { exercise: ex.name, weight: ex.weight > 0 ? ex.weight : null, unit: ex.unit, reps: ex.reps, is_warmup: ex.warmup }
      const result = cur.sessionId ? await api.sessions.addSets(cur.sessionId, [payload]) : await api.sessions.create({ type: cur.type, sets: [payload] })
      const saved = result.session
      setSession(saved)

      const prevBest = bests[ex.name]?.[ex.unit] ?? null
      const isPr = !ex.warmup && ex.weight > 0 && prevBest != null && ex.weight > prevBest
      if (!ex.warmup && ex.weight > 0) setBests((b) => ({ ...b, [ex.name]: { ...b[ex.name], [ex.unit]: Math.max(prevBest ?? 0, ex.weight) } }))

      const total = settings.get().restSeconds
      const setNo = saved.sets.filter((s) => s.exercise === ex.name).length
      patchDraft({
        sessionId: saved.id,
        rest: { endsAt: Date.now() + total * 1000, total, result: { exercise: ex.name, setNo, weight: ex.weight, unit: ex.unit, reps: ex.reps, isPr, prevBest, warmup: ex.warmup } },
      })
      patchExercise(cur.active, { reps: 0 })
      return true
    } catch (e) {
      setError(`Could not save that set. Your numbers are kept, try again. (${messageOf(e)})`)
      return false
    } finally {
      setBusy(false)
    }
  }, [bests])

  /** Add several sets at once from shorthand. The server parses the text; this only sends it. */
  const addShorthand = useCallback(async (text) => {
    const cur = draft.get()
    const ex = cur.exercises[cur.active]
    setBusy(true)
    setError('')
    try {
      const item = { exercise: ex.name, shorthand: text, unit: ex.unit, is_warmup: ex.warmup }
      const result = cur.sessionId ? await api.sessions.addSets(cur.sessionId, [item]) : await api.sessions.create({ type: cur.type, sets: [item] })
      patchDraft({ sessionId: result.session.id })
      setSession(result.session)
      return true
    } catch (e) {
      setError(messageOf(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const editSet = useCallback(async (id, changes) => {
    setError('')
    const updated = await api.sets.update(id, changes)
    setSession((s) => (s ? { ...s, sets: s.sets.map((x) => (x.id === id ? updated : x)) } : s))
  }, [])

  const removeSet = useCallback(async (id) => {
    setError('')
    await api.sets.remove(id)
    setSession((s) => (s ? { ...s, sets: s.sets.filter((x) => x.id !== id) } : s))
  }, [])

  const addExercise = useCallback(
    async ({ name, unit }) => {
      const cur = draft.get()
      const existing = cur.exercises.findIndex((e) => e.name.toLowerCase() === name.toLowerCase())
      if (existing !== -1) {
        patchDraft({ active: existing })
        return
      }
      let lastSets = []
      let lastDate = null
      try {
        const found = await idFor(name)
        if (found) {
          const history = (await api.exercises.history(found.id, 60)).filter((h) => h.session_id !== cur.sessionId && !h.is_warmup)
          const newest = history[0]
          if (newest) {
            lastDate = newest.date
            lastSets = history.filter((h) => h.session_id === newest.session_id).sort((a, b) => a.set_order - b.set_order).map((h) => ({ weight: h.weight, unit: h.unit, reps: h.reps ?? 0 }))
          }
        }
      } catch {
        /* a new exercise can start without history */
      }
      const useUnit = lastSets.length ? commonUnit(lastSets.map((s) => ({ unit: s.unit }))) : unit
      const first = lastSets.find((s) => s.unit === useUnit)
      draft.set((x) => ({
        ...x,
        exercises: [...x.exercises, { name, unit: useUnit, weight: first?.weight ?? 0, reps: 0, warmup: false, plateStack: [], lastSets, lastDate }],
        active: x.exercises.length,
      }))
    },
    [idFor],
  )

  /** Keep a run (or any other change) saved even before a set exists: make sure the session exists. */
  const saveRun = useCallback(
    async (run) => {
      const cur = draft.get()
      if (!cur.sessionId) {
        const { id, result } = await ensureSession({ run })
        if (result) return result.session.run
        return (await api.sessions.get(id)).run
      }
      const saved = await api.sessions.setRun(cur.sessionId, run)
      setSession((s) => (s ? { ...s, run: saved } : s))
      return saved
    },
    [ensureSession],
  )

  /** Forget the in-progress session (the sets stay saved on the server). */
  const endSession = useCallback(() => {
    draft.clear()
    setSession(null)
    setBests({})
  }, [])

  /**
   * Finish the session. Returns the id to show a summary for. When something was saved, the draft is
   * kept until the summary opens (it calls endSession): clearing it here would trip the route guard
   * and bounce you home before the summary shows. When nothing was saved there is nothing to show.
   */
  const finish = useCallback(() => {
    const id = draft.get()?.sessionId ?? null
    if (!id) endSession()
    return id
  }, [endSession])

  const value = useMemo(
    () => ({ draft: d, session, bests, busy, error, setError, startSession, logSet, addShorthand, editSet, removeSet, addExercise, saveRun, finish, endSession }),
    [d, session, bests, busy, error, startSession, logSet, addShorthand, editSet, removeSet, addExercise, saveRun, finish, endSession],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
