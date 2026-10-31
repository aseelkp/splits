import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import ErrorLine from '../components/ErrorLine'
import Icon from '../components/Icon'
import { shortDate } from '../lib/dates'
import { bestWeight, firstPrIndex, groupBySession, sessionPoints, unitsInUse } from '../lib/stats'
import { formatWeight, round2 } from '../lib/units'

const cap = (s) => s[0].toUpperCase() + s.slice(1)
const W = 350
const BASE = 150
const MAX_H = 112

function Bars({ points, unit }) {
  const max = Math.max(...points.map((p) => p.weight))
  const pr = firstPrIndex(points)
  const n = points.length
  const bw = Math.min(30, (W - 8) / n - 6)
  const x = (i) => (n === 1 ? (W - bw) / 2 : (i * (W - bw)) / (n - 1))
  const label = `Bar chart of your heaviest ${unit} set per session, from ${formatWeight(points[0].weight)} on ${shortDate(points[0].date)} to ${formatWeight(points[n - 1].weight)} on ${shortDate(points[n - 1].date)}. Bars start at zero.`

  return (
    <svg role="img" aria-label={label} width="100%" viewBox={`0 0 ${W} 196`} style={{ display: 'block', maxWidth: '36rem' }}>
      <line x1="0" y1={BASE + 8} x2={W} y2={BASE + 8} stroke="var(--rule)" strokeWidth="2" />
      {points.map((p, i) => {
        const h = Math.max(4, (p.weight / max) * MAX_H)
        const y = BASE + 8 - h
        const hot = i === pr
        return (
          <g key={p.sessionId}>
            <rect x={x(i)} y={y} width={bw} height={h} rx={bw / 2} fill={hot ? 'var(--accent)' : 'var(--plate-neutral)'} />
            <text x={x(i) + bw / 2} y={y - 6} textAnchor="middle" fontSize="14" fontWeight={hot ? 800 : 700} fill={hot ? 'var(--accent)' : 'var(--muted)'}>
              {formatWeight(p.weight)}
            </text>
            {hot && (
              <text x={x(i) + bw / 2} y={y - 22} textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--accent)">
                PR
              </text>
            )}
          </g>
        )
      })}
      <text x="0" y="190" fontSize="14" fill="var(--muted)">
        {shortDate(points[0].date)}
      </text>
      {n > 2 && (
        <text x={x(pr) + bw / 2} y="190" textAnchor="middle" fontSize="14" fill="var(--muted)">
          {pr !== 0 && pr !== n - 1 ? shortDate(points[pr].date) : ''}
        </text>
      )}
      {n > 1 && (
        <text x={W} y="190" textAnchor="end" fontSize="14" fill="var(--muted)">
          {shortDate(points[n - 1].date)}
        </text>
      )}
    </svg>
  )
}

export default function ExercisePage() {
  const { id } = useParams()
  const [exercise, setExercise] = useState(null)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  const [pickedUnit, setPickedUnit] = useState(null)

  useEffect(() => {
    setExercise(null)
    setHistory(null)
    Promise.all([api.exercises.get(id), api.exercises.history(id, 500)])
      .then(([e, h]) => {
        setExercise(e)
        setHistory(h)
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this exercise.'))
  }, [id])

  const units = useMemo(() => (history ? unitsInUse(history) : []), [history])
  const unit = pickedUnit ?? units[0] ?? exercise?.default_unit ?? 'kg'
  const points = useMemo(() => (history ? sessionPoints(history, unit).slice(-8) : []), [history, unit])
  const groups = useMemo(() => (history ? groupBySession(history).slice(0, 12) : []), [history])

  const sessionCount = history ? new Set(history.map((h) => h.session_id)).size : 0
  const heaviest = history ? bestWeight(history, unit) : null
  const mostReps = history ? Math.max(0, ...history.filter((s) => s.unit === unit && !s.is_warmup).map((s) => s.reps ?? 0)) : 0
  const gain = points.length > 1 ? round2(points[points.length - 1].weight - points[0].weight) : 0

  return (
    <div className="screen split">
      <header className="topbar">
        <Link to="/exercises" className="iconbtn" aria-label="Back to exercises">
          <Icon name="back" />
        </Link>
        <span className="topbar-title">Exercise</span>
        <span style={{ width: '3rem' }} />
      </header>

      <ErrorLine>{error}</ErrorLine>
      {!exercise && !error && <div className="skeleton" aria-hidden="true" />}

      {exercise && history && (
        <>
          <div className="split-main">
          <div className="page-head">
            <h1>{exercise.name}</h1>
            <p>
              {cap(exercise.category)}, usually in {exercise.default_unit}, {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
            </p>
          </div>

          {history.length === 0 ? (
            <p className="empty">No sets logged for {exercise.name} yet.</p>
          ) : (
            <>
              {units.length > 1 && (
                <div className="pad" style={{ paddingTop: '0.875rem' }}>
                  <div className="seg small" role="group" aria-label="Unit to show">
                    {units.map((u) => (
                      <button key={u} type="button" className="pill" aria-pressed={unit === u} onClick={() => setPickedUnit(u)}>
                        {u}
                      </button>
                    ))}
                  </div>
                  <p className="muted" style={{ paddingTop: '0.375rem', fontSize: '0.9375rem' }}>
                    You logged this in both. Numbers below only compare {unit} with {unit}.
                  </p>
                </div>
              )}

              {heaviest != null ? (
                <div className="big-stat">
                  <span className="n">{formatWeight(heaviest)}</span>
                  <span className="side">
                    <span className="u">{unit} heaviest</span>
                    {gain > 0 && (
                      <span className="tag">
                        +{formatWeight(gain)} since {shortDate(points[0].date)}
                      </span>
                    )}
                    {mostReps > 0 && <span className="muted" style={{ fontSize: '0.9375rem' }}>Most reps in a set: {mostReps}</span>}
                  </span>
                </div>
              ) : (
                <p className="empty">No weighted {unit} sets to chart.</p>
              )}

              {points.length > 0 && (
                <>
                  <h2 className="section-title" style={{ paddingTop: '1.5rem' }}>Heaviest set per session</h2>
                  <div className="chart">
                    <Bars points={points} unit={unit} />
                    <p className="chart-note">Bars start at zero. Lime marks the first time you hit your heaviest.</p>
                  </div>
                </>
              )}

            </>
          )}
          </div>

          {history.length > 0 && (
            <div className="split-side">
              <h2 className="section-title">History</h2>
              <div className="list">
                {groups.map((g) => (
                  <div key={g.sessionId} className="history-row">
                    <span className="d">{shortDate(g.date)}</span>
                    <span className="sets">
                      {g.sets.map((s) => (
                        <span key={s.id} className={`mini-chip ${s.is_warmup ? 'is-warm' : ''}`}>
                          {s.weight != null ? `${formatWeight(s.weight)} x ${s.reps ?? '-'}` : `BW x ${s.reps ?? '-'}`}
                          <span className="muted" style={{ fontWeight: 500 }}> {s.unit}</span>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
