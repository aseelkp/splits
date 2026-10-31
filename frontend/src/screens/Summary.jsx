import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import ErrorLine from '../components/ErrorLine'
import Icon from '../components/Icon'
import PrSticker from '../components/PrSticker'
import { dayAndDate, shortDate } from '../lib/dates'
import { formatClock, pace, thousands } from '../lib/format'
import { bestWeight, groupByExercise, previousOfSameType, totalsByUnit } from '../lib/stats'
import { formatWeight, round2 } from '../lib/units'
import { useSession } from '../session/SessionContext'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

/** For one exercise in this session: which units set a new best, by how much. */
function prsFor(sets, history, sessionId) {
  const prs = []
  for (const unit of new Set(sets.map((s) => s.unit))) {
    const inSession = sets.filter((s) => s.unit === unit && !s.is_warmup && s.weight != null)
    if (!inSession.length) continue
    const top = Math.max(...inSession.map((s) => s.weight))
    const before = bestWeight(history, unit, sessionId)
    if (before != null && top > before) prs.push({ unit, weight: top })
  }
  return prs
}

export default function Summary() {
  const { id } = useParams()
  const nav = useNavigate()
  const { draft, endSession } = useSession()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  // Opening the summary of the session you were just logging ends that draft.
  useEffect(() => {
    if (draft && String(draft.sessionId) === id) endSession()
  }, [draft, id, endSession])

  useEffect(() => {
    setData(null)
    ;(async () => {
      try {
        const [session, all] = await Promise.all([api.sessions.get(id), api.sessions.list(200)])
        const groups = groupByExercise(session.sets)
        const histories = await Promise.all(groups.map((g) => api.exercises.history(g.exerciseId, 500)))
        const rows = groups.map((g, i) => ({ ...g, prs: prsFor(g.sets, histories[i], session.id), totals: totalsByUnit(g.sets) }))
        setData({ session, rows, previous: previousOfSameType(all, session) })
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load this session.')
      }
    })()
  }, [id])

  async function remove() {
    try {
      await api.sessions.remove(id)
      nav('/', { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete this session.')
    }
  }

  if (error && !data) {
    return (
      <div className="screen">
        <header className="topbar">
          <Link to="/" className="iconbtn" aria-label="Back to home">
            <Icon name="back" />
          </Link>
        </header>
        <ErrorLine>{error}</ErrorLine>
      </div>
    )
  }
  if (!data) return <div className="screen"><div className="skeleton" aria-hidden="true" /></div>

  const { session, rows, previous } = data
  const totals = totalsByUnit(session.sets)
  // Compare like with like: only exercises done in both sessions with the same number of sets, so a
  // shorter session never reads as a regression. Totals for both sides use just those exercises.
  const prevGroups = previous ? groupByExercise(previous.sets) : []
  const comparable = new Set(rows.filter((r) => prevGroups.find((g) => g.name === r.name)?.sets.length === r.sets.length).map((r) => r.name))
  const prevTotals = previous ? totalsByUnit(previous.sets.filter((x) => comparable.has(x.exercise))) : {}
  const nowTotals = totalsByUnit(session.sets.filter((x) => comparable.has(x.exercise)))
  const prCount = rows.reduce((n, r) => n + r.prs.length, 0)
  const units = Object.keys(totals)
  const setCount = session.sets.length
  const maxByUnit = {}
  for (const r of rows) for (const [u, v] of Object.entries(r.totals)) maxByUnit[u] = Math.max(maxByUnit[u] ?? 0, v)

  const run = session.run
  const runPace = run ? pace(run.duration_seconds, run.distance_km) : null

  return (
    <div className="screen">
      <header className="topbar" style={{ paddingBottom: 0 }}>
        <Link to="/" className="iconbtn" aria-label="Back to home">
          <Icon name="back" />
        </Link>
        <span className="topbar-note" aria-live="polite" />
      </header>

      <div className="summary-head" style={{ paddingTop: '0.5rem' }}>
        <div>
          <h1>{cap(session.type)}, done.</h1>
          <p>{dayAndDate(session.date)}</p>
        </div>
        {prCount > 0 && <PrSticker size={96} top={null} main={String(prCount)} label={`${prCount} new personal ${prCount === 1 ? 'record' : 'records'}`} />}
      </div>

      {units.length > 0 && (
        <div className="totals">
          {units.map((u) => {
            const before = prevTotals[u]
            const diff = before != null && before > 0 && nowTotals[u] != null ? round2(nowTotals[u] - before) : null
            return (
              <div key={u} style={{ paddingBottom: '0.5rem' }}>
                <div className="line">
                  <span className="n">{thousands(totals[u])}</span>
                  <span className="u">{u} lifted</span>
                </div>
                {diff != null && (
                  <p className={`vs ${diff > 0 ? 'accent' : 'flat'}`}>
                    {diff !== 0 && <Icon name={diff > 0 ? 'up' : 'down'} size={20} stroke={3} />}
                    {diff === 0 ? `Matches the same lifts on ${shortDate(previous.date)}` : `${thousands(Math.abs(diff))} ${u} ${diff > 0 ? 'more' : 'less'} than the same ${comparable.size === 1 ? 'lift' : 'lifts'} on ${shortDate(previous.date)}`}
                  </p>
                )}
              </div>
            )
          })}
          <p className="fine">
            {setCount} {setCount === 1 ? 'set' : 'sets'}. Total is weight x reps over working sets; warm-ups are left out.
            {units.length > 1 && ' Different units are never added together.'}
          </p>
        </div>
      )}

      {run && (
        <div className="totals">
          <div className="line">
            <span className="n">{run.distance_km != null ? Number(run.distance_km).toFixed(2) : '--'}</span>
            <span className="u">km, {run.mode} run</span>
          </div>
          <p className="fine" style={{ color: 'var(--fg)' }}>
            {[run.duration_seconds ? formatClock(run.duration_seconds) : null, runPace ? `pace ${runPace} /km` : null, run.avg_hr ? `avg ${run.avg_hr} bpm` : null, run.max_hr ? `max ${run.max_hr} bpm` : null].filter(Boolean).join(', ') || 'No details saved.'}
          </p>
          {run.structure && <p className="fine">{run.structure}</p>}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <h2 className="section-title" style={{ paddingTop: '1.25rem' }}>By exercise</h2>
          <div className="list">
            {rows.map((r) => {
              const u = Object.keys(r.totals)[0]
              const pr = r.prs[0]
              return (
                <div key={r.name} className="vol-row">
                  <div className="top">
                    <span className="name">
                      {r.name}
                      {pr && <span className="pr">PR {formatWeight(pr.weight)} {pr.unit}</span>}
                    </span>
                    <span className="val">
                      {u ? Object.entries(r.totals).map(([unit, v]) => `${thousands(v)} ${unit}`).join(' + ') : `${r.sets.length} sets`}
                    </span>
                  </div>
                  {u && (
                    <div className="vol-track" aria-hidden="true">
                      <div className="vol-fill" style={{ width: `${Math.max(4, (r.totals[u] / maxByUnit[u]) * 100)}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="grow" />
      <div className="pad" style={{ paddingTop: '1.25rem' }}>
        <Link to="/" className="btn-primary plain">
          Back to home
        </Link>
        <ErrorLine>{error}</ErrorLine>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.25rem' }}>
          {!confirming ? (
            <button type="button" className="link-btn" onClick={() => setConfirming(true)}>
              Delete this session
            </button>
          ) : (
            <div role="alert" style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 700, paddingBottom: '0.375rem' }}>Delete this whole session for good?</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button type="button" className="pill" onClick={remove}>
                  Yes, delete
                </button>
                <button type="button" className="pill" onClick={() => setConfirming(false)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
