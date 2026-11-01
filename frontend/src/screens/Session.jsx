import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Bar from '../components/Bar'
import CancelSession from '../components/CancelSession'
import ErrorLine from '../components/ErrorLine'
import Icon from '../components/Icon'
import PlateButtons from '../components/PlateButtons'
import RepRing from '../components/RepRing'
import { shortDate, todayIST } from '../lib/dates'
import { addPlate, formatWeight, newPlateFlags, platesPerSide, removePlate, round2, UNIT_NAMES, UNITS } from '../lib/units'
import { useSession } from '../session/SessionContext'
import { patchDraft, patchExercise } from '../store/draft'
import AddExerciseSheet from './sheets/AddExerciseSheet'
import SetEditSheet from './sheets/SetEditSheet'
import ShorthandSheet from './sheets/ShorthandSheet'
import Rest from './Rest'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

// The weight field is as wide as its digits (a decimal point is narrower), so the unit sits right next to it.
const inputWidthEm = (text) => Math.max(1, [...text].reduce((w, c) => w + (c === '.' ? 0.3 : 0.6), 0)) + 0.05

export default function Session() {
  const { draft } = useSession()
  return draft.rest ? <Rest /> : <SetScreen />
}

function SetScreen() {
  const nav = useNavigate()
  const { draft, session, error, setError, busy, logSet, finish } = useSession()
  const idx = draft.active
  const ex = draft.exercises[idx]

  const [wText, setWText] = useState(ex && ex.weight ? formatWeight(ex.weight) : '')
  const [typing, setTyping] = useState(false)
  const [sheet, setSheet] = useState(null) // 'add' | 'shorthand' | { set }

  // Keep the weight field in step when the weight changes some other way (plates, switching exercise).
  useEffect(() => {
    if (!ex) return
    if ((Number(wText) || 0) !== ex.weight) setWText(ex.weight ? formatWeight(ex.weight) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex?.weight, idx])

  useEffect(() => setTyping(false), [idx])

  const today = todayIST()

  function leave(toSummary) {
    const id = finish()
    nav(toSummary && id ? `/summary/${id}` : '/')
  }

  const topbar = (
    <header className="topbar">
      <Link to="/" className="iconbtn" aria-label="Back to home">
        <Icon name="back" />
      </Link>
      <span className="topbar-title">
        {cap(draft.type)}, {shortDate(today)}
      </span>
      <button type="button" className="link-btn" onClick={() => leave(true)}>
        Finish
      </button>
    </header>
  )

  const strip = (
    <nav className="strip" aria-label="Exercises in this session">
      {draft.exercises.map((e, i) => (
        <button key={e.name} type="button" className="pill" style={{ maxWidth: '11rem', overflow: 'hidden', textOverflow: 'ellipsis' }} aria-current={i === idx} onClick={() => patchDraft({ active: i })}>
          {i + 1} {e.name}
        </button>
      ))}
      <button type="button" className="pill" onClick={() => setSheet('add')}>
        <Icon name="plus" size={18} />
        Exercise
      </button>
      <Link to="/run" className="pill">
        <Icon name="plus" size={18} />
        Run
      </Link>
    </nav>
  )

  if (!ex) {
    return (
      <div className="screen">
        {topbar}
        {strip}
        <p className="empty">No exercises yet. Add the first one to start logging.</p>
        <div className="pad">
          <button type="button" className="btn-primary plain" onClick={() => setSheet('add')}>
            Add exercise
          </button>
        </div>
        <div className="pad" style={{ paddingTop: '0.5rem' }}>
          <CancelSession />
        </div>
        <AddExerciseSheet open={sheet === 'add'} onClose={() => setSheet(null)} />
      </div>
    )
  }

  const logged = (session?.sets ?? []).filter((s) => s.exercise === ex.name)
  const setNo = logged.length + 1
  const ref = ex.lastSets[logged.length] ?? ex.lastSets[ex.lastSets.length - 1] ?? null
  const refSame = ref && ref.unit === ex.unit && ref.weight != null ? ref : null

  const { plates, leftover, underBar } = platesPerSide(ex.weight, ex.unit)
  const lastPlates = refSame ? platesPerSide(refSame.weight, refSame.unit).plates : []
  const flags = refSame ? newPlateFlags(plates, lastPlates) : plates.map(() => false)

  let delta = null
  if (refSame && ex.weight > 0) {
    const diff = round2(ex.weight - refSame.weight)
    delta = diff > 0 ? { kind: 'up', text: `${formatWeight(diff)} ${ex.unit} vs last` } : diff < 0 ? { kind: 'down', text: `${formatWeight(-diff)} ${ex.unit} vs last` } : { kind: 'flat', text: 'same as last' }
  }

  const bar = UNITS[ex.unit].bar
  let caption
  if (!ex.weight) caption = `Tap a plate to load the ${bar} ${ex.unit} bar, or type a weight.`
  else if (underBar) caption = `Lighter than the ${bar} ${ex.unit} bar. Type any weight for dumbbells and machines.`
  else if (leftover > 0) caption = `Each side: ${plates.length ? plates.map(formatWeight).join(' + ') : 'no plates'}. The last ${formatWeight(leftover)} ${ex.unit} is not plate-sized: fine for dumbbells and machines.`
  else if (plates.length === 0) caption = `Empty ${bar} ${ex.unit} bar.`
  else caption = `Each side: ${plates.map(formatWeight).join(' + ')}.${flags.some(Boolean) ? ' Outlined plates are new since last time.' : ''}`
  if (ref && !refSame) caption += ` Last time was ${ref.weight != null ? formatWeight(ref.weight) : 'bodyweight'} ${ref.unit}, so there is nothing to compare.`

  // Where "last time" came from. The exercise decides it, so it can be another kind of session.
  // Short form for one row: "62.5 x 8" (the unit is added only if it is not the one on screen).
  const brief = (sets) => {
    const f = sets[0]
    return `${f.weight != null ? formatWeight(f.weight) : 'BW'}${f.unit !== ex.unit ? ` ${f.unit}` : ''} x ${f.reps}`
  }
  const full = (sets) => `${brief(sets)} ${sets[0].unit}, ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`
  const lastSame = ex.lastSame?.sets?.length ? ex.lastSame : null
  const useLastSame = () => set({ unit: lastSame.sets[0].unit, weight: lastSame.sets[0].weight ?? 0, plateStack: [] })

  const sameReps = logged.length ? logged[logged.length - 1].reps : ref?.reps
  const set = (changes) => patchExercise(idx, changes)

  function onWeightText(e) {
    const v = e.target.value.replace(',', '.')
    if (!/^\d{0,4}(\.\d{0,2})?$/.test(v)) return
    setWText(v)
    set({ weight: Number(v) || 0, plateStack: [] })
  }

  function onRemovePlate() {
    set((e) => {
      if (e.plateStack.length) {
        const p = e.plateStack[e.plateStack.length - 1]
        return { weight: round2(Math.max(0, e.weight - 2 * p)), plateStack: e.plateStack.slice(0, -1) }
      }
      return { weight: removePlate(e.weight, e.unit), plateStack: [] }
    })
  }

  return (
    <div className="screen split split-session">
      {topbar}
      {strip}

      <div className="set-panel">
      <div className="ex-head">
        <h1>{ex.name}</h1>
        <div className="seg small" role="group" aria-label="Weight unit">
          {UNIT_NAMES.map((u) => (
            <button key={u} type="button" className="pill" aria-pressed={ex.unit === u} onClick={() => set({ unit: u, plateStack: [] })}>
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="weight-line">
        <label className="sr-only" htmlFor="weight">
          Weight in {ex.unit}
        </label>
        <input id="weight" className="weight-input" inputMode="decimal" value={wText} placeholder="0" style={{ width: `${inputWidthEm(wText)}em` }} onChange={onWeightText} />
        <span className="weight-unit">{ex.unit}</span>
        <span className="grow" />
        {delta && (
          <span className={`delta ${delta.kind === 'up' ? 'accent' : delta.kind}`}>
            {delta.kind !== 'flat' && <Icon name={delta.kind === 'up' ? 'up' : 'down'} size={18} stroke={3} />}
            {delta.text}
          </span>
        )}
      </div>

      {ex.lastSets.length > 0 && (
        <p className="last-note">
          <span title={`${shortDate(ex.lastDate)}: ${full(ex.lastSets)}`}>
            Last time{ex.lastType ? ` (${cap(ex.lastType)})` : ''}: {brief(ex.lastSets)}
          </span>
          {lastSame && (
            <button type="button" className="link-btn" onClick={useLastSame} aria-label={`Use the weight from your last ${draft.type} day, ${shortDate(lastSame.date)}: ${full(lastSame.sets)}`}>
              {cap(draft.type)} day: {brief(lastSame.sets)}
            </button>
          )}
        </p>
      )}

      <div className="bar-wrap">
        <Bar plates={plates} flags={flags} unit={ex.unit} />
        <p className="bar-caption">{caption}</p>
      </div>

      <PlateButtons unit={ex.unit} onAdd={(p) => set((e) => ({ weight: addPlate(e.weight, p, e.unit), plateStack: [...e.plateStack, p] }))} />
      <div className="plate-row">
        <span>Tap to add a plate each side</span>
        <button type="button" className="link-btn" onClick={onRemovePlate} disabled={plates.length === 0} style={{ opacity: plates.length === 0 ? 0.5 : 1 }}>
          Remove plate
        </button>
      </div>

      <div className="reps">
        <button type="button" className="round-btn" aria-label="One rep fewer" onClick={() => set({ reps: Math.max(0, ex.reps - 1) })}>
          <Icon name="minus" stroke={2.6} />
        </button>
        <RepRing
          reps={ex.reps}
          last={ref?.reps || null}
          typing={typing}
          onTap={() => set({ reps: ex.reps + 1 })}
          onType={(v) => /^\d{0,3}$/.test(v) && set({ reps: Number(v) })}
        />
        <button type="button" className="round-btn" aria-label={typing ? 'Count reps by tapping' : 'Type the reps instead'} aria-pressed={typing} onClick={() => setTyping((t) => !t)}>
          <Icon name="keyboard" size={26} stroke={2.2} />
        </button>
      </div>

      <div className="warm-toggle" style={{ gap: '0.5rem' }}>
        {ex.reps === 0 && sameReps > 0 && (
          <button type="button" className="pill" onClick={() => set({ reps: sameReps })}>
            Use {sameReps} reps
          </button>
        )}
        <button type="button" className="pill" aria-pressed={ex.warmup} onClick={() => set({ warmup: !ex.warmup })}>
          Warm-up set
        </button>
      </div>

      <div className="log-area">
        <ErrorLine>{error}</ErrorLine>
        <button type="button" className="btn-primary plain" style={{ marginTop: error ? '0.75rem' : 0 }} onClick={logSet} disabled={busy}>
          {busy ? 'Saving' : `Log set ${setNo}`}
        </button>
      </div>

      </div>

      <div className="chips">
        {logged.length === 0 && (
          <span className="muted" style={{ fontSize: '0.9375rem' }}>
            No sets yet.
            {ex.targetSets
              ? ` Plan: ${ex.targetSets} ${ex.targetSets === 1 ? 'set' : 'sets'}.`
              : ex.lastSets.length
                ? ` Last time: ${ex.lastSets.length} ${ex.lastSets.length === 1 ? 'set' : 'sets'}.`
                : ''}
          </span>
        )}
        {logged.map((s, i) => (
          <button key={s.id} type="button" className={`chip ${s.is_warmup ? 'is-warm' : ''}`} aria-label={`Edit set ${i + 1}`} onClick={() => setSheet({ set: s })}>
            <span className="n">{s.is_warmup ? 'W' : i + 1}</span>
            {s.weight != null ? `${formatWeight(s.weight)} x ${s.reps ?? '-'}` : s.reps != null ? `BW x ${s.reps}` : `${s.duration_seconds}s`}
            <span className="u">{s.unit}</span>
          </button>
        ))}
        <button type="button" className="link-btn" style={{ flex: '0 0 auto' }} onClick={() => { setError(''); setSheet('shorthand') }}>
          Shorthand
        </button>
      </div>

      <div className="pad" style={{ paddingTop: '0.5rem' }}>
        <CancelSession />
      </div>

      <AddExerciseSheet open={sheet === 'add'} onClose={() => setSheet(null)} />
      <ShorthandSheet open={sheet === 'shorthand'} onClose={() => setSheet(null)} exercise={ex} startNo={logged.length + 1} />
      <SetEditSheet open={Boolean(sheet && sheet.set)} set={sheet?.set} onClose={() => setSheet(null)} />
    </div>
  )
}
