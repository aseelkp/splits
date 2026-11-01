import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import ErrorLine from '../components/ErrorLine'
import CancelSession from '../components/CancelSession'
import Icon from '../components/Icon'
import { daysBetween, shortDate, todayIST, weekday } from '../lib/dates'
import { formatWeight, plateColor, platesPerSide } from '../lib/units'
import { dueType, groupByExercise, lastByType } from '../lib/stats'
import { useSession } from '../session/SessionContext'

const TYPES = ['pull', 'push', 'lower', 'upper', 'run', 'other']
const DISC_COLOR = { pull: 'blue', push: 'green', lower: 'yellow', upper: 'white', run: 'red', other: 'silver' }
const cap = (s) => s[0].toUpperCase() + s.slice(1)

/** Biggest working set of a session, for the right-hand number in the list. */
function topSet(session) {
  if (session.run && session.sets.length === 0) return { text: Number(session.run.distance_km ?? 0).toFixed(2), unit: 'km' }
  const sets = session.sets.filter((s) => !s.is_warmup && s.weight != null)
  if (!sets.length) return null
  const unit = sets[0].unit
  const best = sets.filter((s) => s.unit === unit).reduce((a, b) => (b.weight > a.weight ? b : a))
  return { text: formatWeight(best.weight), unit: `${unit} x ${best.reps ?? '-'}`, weight: best.weight, plateUnit: unit }
}

function MiniBar({ session }) {
  const top = topSet(session)
  if (!top || !top.plateUnit) {
    return (
      <svg aria-hidden="true" width="52" height="24" viewBox="0 0 52 24" className="mini-bar">
        <rect x="6" y="3" width="40" height="18" rx="9" fill="none" stroke="var(--plate-red)" strokeWidth="3" />
      </svg>
    )
  }
  const { plates } = platesPerSide(top.weight, top.plateUnit)
  const shown = plates.slice(0, 3)
  return (
    <svg aria-hidden="true" width="52" height="24" viewBox="0 0 52 24" className="mini-bar">
      <line x1="2" y1="12" x2="50" y2="12" stroke="var(--muted)" strokeWidth="2" />
      {shown.map((p, i) => {
        const h = 22 - i * 6
        const color = plateColor(p, top.plateUnit)
        return (
          <g key={i}>
            <rect x={8 + i * 7} y={12 - h / 2} width="5" height={h} rx="2" fill={`var(--plate-${color})`} stroke="var(--edge)" strokeWidth="1.5" />
            <rect x={52 - 8 - i * 7 - 5} y={12 - h / 2} width="5" height={h} rx="2" fill={`var(--plate-${color})`} stroke="var(--edge)" strokeWidth="1.5" />
          </g>
        )
      })}
    </svg>
  )
}

export default function Home() {
  const nav = useNavigate()
  const { draft, startSession, finish, busy, error: startError } = useSession()
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)
  const today = todayIST()

  useEffect(() => {
    api.sessions
      .list(200)
      .then(setSessions)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your sessions.'))
  }, [])

  const last = useMemo(() => lastByType(sessions ?? []), [sessions])
  const days = (d) => daysBetween(d, today)
  const due = useMemo(() => dueType(last, days), [last, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const selected = picked ?? due ?? 'push'

  const discs = TYPES.map((type) => {
    const l = last[type]
    const n = l ? days(l.date) : null
    return { type, n, d: l ? Math.max(84, Math.min(124, Math.round(72 + n * 3.5))) : 80 }
  }).sort((a, b) => (b.n ?? -1) - (a.n ?? -1))

  const lastSel = last[selected]
  const exerciseCount = lastSel ? groupByExercise(lastSel.sets).length : 0
  const hint = !lastSel
    ? 'First one. You can add exercises as you go.'
    : selected === 'run'
      ? `Last run: ${Number(lastSel.run?.distance_km ?? 0).toFixed(2)} km on ${shortDate(lastSel.date)}.`
      : `Starts pre-filled from ${shortDate(lastSel.date)}: ${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}.`

  async function start() {
    if (await startSession(selected)) nav(selected === 'run' ? '/run' : '/session')
  }

  const heading = draft ? 'Session in progress.' : due ? `${cap(due)} is due.` : sessions && sessions.length === 0 ? 'Ready when you are.' : 'Pick a day.'
  const sub = `${weekday(today)} ${shortDate(today)}${due && !draft ? `. ${days(last[due].date)} days since your last ${due}.` : ''}`

  return (
    <div className="screen split">
      <header className="topbar hide-wide" style={{ paddingLeft: '1.25rem' }}>
        <span className="home-title">splits</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Link to="/settings" className="iconbtn" aria-label="Settings">
            <Icon name="settings" />
          </Link>
          <Link to="/exercises" className="pill">
            Exercises
          </Link>
        </span>
      </header>

      <div className="split-main">
      <section className="hero">
        <h1>{heading}</h1>
        <p>{sub}</p>
      </section>

      {draft ? (
        <section className="resume" aria-label="Session in progress">
          <h2>{cap(draft.type)}</h2>
          <p>{draft.sessionId ? 'Your sets are saved.' : 'Nothing logged yet.'} Pick up where you left off.</p>
          <button type="button" className="btn-primary" onClick={() => nav(draft.type === 'run' ? '/run' : '/session')}>
            Resume {draft.type}
            <span className="arrow">
              <Icon name="arrow" stroke={2.6} />
            </span>
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.25rem' }}>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                const id = finish()
                nav(id ? `/summary/${id}` : '/')
              }}
            >
              Finish this session
            </button>
          </div>
          <CancelSession />
        </section>
      ) : (
        <>
          <div className="discs" role="group" aria-label="Session type">
            {discs.map(({ type, n, d }) => (
              <button
                key={type}
                type="button"
                className={`disc ${n == null ? 'is-new' : `plate-${DISC_COLOR[type]}`}`}
                style={{ '--d': `${d / 16}rem` }}
                aria-pressed={selected === type}
                aria-label={n == null ? `${cap(type)}, not logged yet` : `${cap(type)}, ${n} ${n === 1 ? 'day' : 'days'} since last time`}
                onClick={() => setPicked(type)}
              >
                <span className="d-name">{cap(type)}</span>
                <span className="d-sub">{n == null ? 'new' : `${n} ${n === 1 ? 'day' : 'days'}`}</span>
              </button>
            ))}
          </div>

          <div className="start-area">
            <button type="button" className="btn-primary" onClick={start} disabled={busy || !sessions}>
              Start {selected}
              <span className="arrow">
                <Icon name="arrow" stroke={2.6} />
              </span>
            </button>
            <p className="hint">{sessions ? hint : 'Loading your history'}</p>
            <ErrorLine>{startError}</ErrorLine>
          </div>
        </>
      )}

      <ErrorLine>{error}</ErrorLine>
      </div>

      <div className="split-side">
      <h2 className="section-title">Recent lifts</h2>
      {sessions === null && !error && <div className="skeleton" aria-hidden="true" />}
      {sessions && sessions.length === 0 && <p className="empty">Nothing logged yet. Start your first session above.</p>}
      {sessions && sessions.length > 0 && (
        <div className="list">
          {sessions.slice(0, 4).map((s) => {
            const top = topSet(s)
            const exercises = groupByExercise(s.sets).length
            const summary = s.run && !s.sets.length ? `${s.run.mode === 'indoor' ? 'Indoor' : 'Outdoor'} run` : `${exercises} ${exercises === 1 ? 'exercise' : 'exercises'}, ${s.sets.length} ${s.sets.length === 1 ? 'set' : 'sets'}`
            return (
              <Link key={s.id} to={`/summary/${s.id}`} className="session-row">
                <MiniBar session={s} />
                <span className="t">
                  <b>
                    {cap(s.type)}, {shortDate(s.date)}
                  </b>
                  <span>{summary}</span>
                </span>
                {top && (
                  <span className="top num">
                    {top.text} <small>{top.unit}</small>
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
