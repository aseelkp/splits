import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import PrSticker from '../components/PrSticker'
import { shortDate, todayIST } from '../lib/dates'
import { formatClock } from '../lib/format'
import { formatWeight, round2 } from '../lib/units'
import { useSession } from '../session/SessionContext'
import { patchDraft } from '../store/draft'

const R = 96
const C = 2 * Math.PI * R
const cap = (s) => s[0].toUpperCase() + s.slice(1)

/** Re-renders ~4 times a second. The timer reads real timestamps, so it stays right if the app was in the background. */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active])
  return now
}

export default function Rest() {
  const nav = useNavigate()
  const { draft, session, finish } = useSession()
  const { rest, active, exercises } = draft
  const { result } = rest
  const now = useNow(true)

  const remaining = Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
  const up = remaining === 0

  // A short buzz when the rest is over (phones that support it).
  const [buzzed, setBuzzed] = useState(false)
  useEffect(() => {
    if (up && !buzzed) {
      setBuzzed(true)
      navigator.vibrate?.([200, 100, 200])
    }
    if (!up && buzzed) setBuzzed(false)
  }, [up, buzzed])

  const adjust = (sec) => {
    const endsAt = Math.max(Date.now(), rest.endsAt + sec * 1000)
    const left = Math.ceil((endsAt - Date.now()) / 1000)
    patchDraft({ rest: { ...rest, endsAt, total: Math.max(15, rest.total, left) } })
  }

  const loggedHere = (session?.sets ?? []).filter((s) => s.exercise === result.exercise)
  const current = exercises[active]
  const next = exercises[active + 1]
  const nextRef = next?.lastSets[0]
  // Last time's number of sets is the plan. While sets remain, the next set is the main action.
  const moreSets = result.setNo < (current?.lastSets.length ?? 0)
  const nextSetRef = current?.lastSets[result.setNo]

  const endRest = () => patchDraft({ rest: null })
  const goNext = () => patchDraft({ active: active + 1, rest: null })
  const done = () => {
    const id = finish()
    nav(id ? `/summary/${id}` : '/')
  }

  const gain = result.isPr ? round2(result.weight - result.prevBest) : 0

  return (
    <div className="screen">
      <header className="topbar">
        <button type="button" className="iconbtn" aria-label="Back to the set screen" onClick={endRest}>
          <Icon name="back" />
        </button>
        <h1 className="topbar-title">
          {cap(draft.type)}, {shortDate(todayIST())}
        </h1>
        <span className="topbar-note">Saved</span>
      </header>

      <div className="logged-head">
        <div>
          <p className="muted" style={{ fontSize: '1.0625rem', fontWeight: 700 }}>
            {result.exercise}, set {result.setNo} logged
          </p>
          <div className="big">
            <span className="n">{result.weight > 0 ? formatWeight(result.weight) : 'BW'}</span>
            <span className="u">
              {result.weight > 0 ? `${result.unit} ` : ''}x {result.reps}
            </span>
          </div>
        </div>
        {result.isPr && <PrSticker size={112} />}
      </div>

      {result.isPr && (
        <p className="delta accent" style={{ padding: '0.25rem 1.25rem 0', fontSize: '1.0625rem' }}>
          <Icon name="up" size={18} stroke={3} />
          {formatWeight(gain)} {result.unit} above your old best of {formatWeight(result.prevBest)}
        </p>
      )}

      <div className="timer-area">
        <div className="timer" role="timer" aria-label={up ? 'Rest is up' : `Rest timer, ${formatClock(remaining)} left`}>
          <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 212 212">
            <circle cx="106" cy="106" r={R} fill="none" stroke="var(--rule)" strokeWidth="12" />
            <circle cx="106" cy="106" r={R} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - remaining / rest.total)} transform="rotate(-90 106 106)" />
          </svg>
          <div className="timer-text">
            <div className="t">{formatClock(remaining)}</div>
            <div className="l">{up ? 'rest is up' : `rest, of ${formatClock(rest.total)}`}</div>
          </div>
        </div>
        <div className="timer-buttons">
          <button type="button" className="pill" onClick={() => adjust(-15)}>
            -15 s
          </button>
          <button type="button" className="pill" onClick={() => adjust(15)}>
            +15 s
          </button>
        </div>
        <p className="muted" style={{ paddingTop: '0.5rem', fontSize: '0.9375rem' }}>Keeps counting if you switch apps.</p>
      </div>

      <div className="chips" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
        {loggedHere.map((s, i) => (
          <span key={s.id} className={`chip ${i === loggedHere.length - 1 && result.isPr ? 'is-pr' : ''}`}>
            <span className="n">{s.is_warmup ? 'W' : i + 1}</span>
            {s.weight != null ? `${formatWeight(s.weight)} x ${s.reps ?? '-'}` : `BW x ${s.reps ?? '-'}`}
            <span className="u">{s.unit}</span>
            {i === loggedHere.length - 1 && result.isPr && <span className="accent" style={{ paddingLeft: '0.5rem', fontWeight: 800 }}>PR</span>}
          </span>
        ))}
      </div>

      <div className="grow" />

      <p className="pad muted" style={{ paddingBottom: '0.375rem', fontSize: '1rem' }}>
        {moreSets
          ? `Next: set ${result.setNo + 1}${nextSetRef ? `, last time ${nextSetRef.weight != null ? formatWeight(nextSetRef.weight) : 'BW'} ${nextSetRef.unit} x ${nextSetRef.reps}` : ''}`
          : next
            ? `Next up: ${next.name}${nextRef ? `, ${nextRef.weight != null ? formatWeight(nextRef.weight) : 'BW'} ${nextRef.unit} x ${nextRef.reps}` : ''}`
            : 'That was the last exercise on the list.'}
      </p>

      <div className="pad">
        <button type="button" className="btn-primary" onClick={moreSets ? endRest : next ? goNext : done}>
          {moreSets ? `Start set ${result.setNo + 1}` : next ? `Start ${next.name}` : 'Finish session'}
          <span className="arrow">
            <Icon name="arrow" stroke={2.6} />
          </span>
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', paddingTop: '0.25rem', flexWrap: 'wrap' }}>
        {moreSets && next && (
          <button type="button" className="link-btn" onClick={goNext}>
            Skip to {next.name}
          </button>
        )}
        {moreSets && !next && (
          <button type="button" className="link-btn" onClick={done}>
            Finish session
          </button>
        )}
        {!moreSets && (
          <button type="button" className="link-btn" onClick={endRest}>
            Add another {result.exercise} set
          </button>
        )}
      </div>
    </div>
  )
}
