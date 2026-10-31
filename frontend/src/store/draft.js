import { createNullableStore } from './createStore'

// The in-progress session, saved on every change so nothing is lost when the app is closed or
// the phone switches apps. Sets you have LOGGED live on the server; this only holds what is not
// saved yet (the numbers on screen, which exercise is open, the rest timer) plus the session id.
//
// {
//   type, sessionId | null, active: index,
//   exercises: [{ name, unit, weight, reps, warmup, plateStack: number[], lastSets: [{weight, unit, reps}], lastDate }],
//   rest: { endsAt, total, result: { exercise, setNo, weight, unit, reps, isPr, prevBest } } | null,
// }
export const draft = createNullableStore('splits.draft.v1')

export const patchDraft = (changes) => draft.set((d) => (d ? { ...d, ...changes } : d))

/** Change one exercise in the draft. */
export const patchExercise = (index, changes) =>
  draft.set((d) => {
    if (!d) return d
    const exercises = d.exercises.map((ex, i) => (i === index ? { ...ex, ...(typeof changes === 'function' ? changes(ex) : changes) } : ex))
    return { ...d, exercises }
  })
