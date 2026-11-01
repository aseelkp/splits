import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import CancelSession from '../components/CancelSession'
import ErrorLine from '../components/ErrorLine'
import Icon from '../components/Icon'
import { shortDate, todayIST } from '../lib/dates'
import { formatClock, pace, parseClock, toNumber } from '../lib/format'
import { useSession } from '../session/SessionContext'

const cap = (s) => s[0].toUpperCase() + s.slice(1)
const TRACK = 759.9 // length of the stadium path below

export default function Run() {
  const nav = useNavigate()
  const { draft, session, saveRun, finish } = useSession()
  const existing = session?.run

  const [mode, setMode] = useState('indoor')
  const [time, setTime] = useState('')
  const [dist, setDist] = useState('')
  const [incline, setIncline] = useState('')
  const [avg, setAvg] = useState('')
  const [max, setMax] = useState('')
  const [structure, setStructure] = useState('')
  const [remark, setRemark] = useState('')
  const [lastRun, setLastRun] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('idle') // idle | saving | saved | error
  const [error, setError] = useState('')
  const loadedFor = useRef(null)

  // Fill the form from a run that is already saved (resuming a session).
  useEffect(() => {
    if (!existing || loadedFor.current === existing.id || dirty) return
    loadedFor.current = existing.id
    setMode(existing.mode)
    setTime(existing.duration_seconds ? formatClock(existing.duration_seconds) : '')
    setDist(existing.distance_km != null ? String(existing.distance_km) : '')
    setIncline(existing.incline_percent != null ? String(existing.incline_percent) : '')
    setAvg(existing.avg_hr != null ? String(existing.avg_hr) : '')
    setMax(existing.max_hr != null ? String(existing.max_hr) : '')
    setStructure(existing.structure ?? '')
    setRemark(existing.remark ?? '')
  }, [existing, dirty])

  useEffect(() => {
    api.sessions
      .last('run')
      .then((s) => setLastRun(s && s.id !== draft?.sessionId ? s.run : null))
      .catch(() => {})
  }, [draft?.sessionId])

  const seconds = parseClock(time)
  const timeError = time.trim() && seconds == null ? 'Use min:sec, like 24:10.' : ''
  const km = toNumber(dist)

  const payload = () => ({
    mode,
    duration_seconds: seconds,
    distance_km: km,
    incline_percent: toNumber(incline),
    avg_hr: toNumber(avg) == null ? null : Math.round(toNumber(avg)),
    max_hr: toNumber(max) == null ? null : Math.round(toNumber(max)),
    structure: structure.trim() || null,
    remark: remark.trim() || null,
  })

  // Autosave: save 700 ms after you stop typing.
  const latest = useRef(payload)
  latest.current = payload
  useEffect(() => {
    if (!dirty || timeError) return
    setStatus('saving')
    const id = setTimeout(async () => {
      try {
        await saveRun(latest.current())
        setStatus('saved')
        setError('')
      } catch (e) {
        setStatus('error')
        setError(e.message || 'Could not save the run. Your numbers are kept here.')
      }
    }, 700)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, mode, time, dist, incline, avg, max, structure, remark])

  const edit = (setter) => (e) => {
    setter(e.target.value)
    setDirty(true)
  }
  const numeric = (setter, pattern) => (e) => {
    const v = e.target.value.replace(',', '.')
    if (pattern.test(v)) {
      setter(v)
      setDirty(true)
    }
  }

  async function done() {
    try {
      if (dirty && !timeError) await saveRun(payload())
    } catch (e) {
      setError(e.message || 'Could not save the run.')
      setStatus('error')
      return
    }
    if (draft.type === 'run') {
      const id = finish()
      nav(id ? `/summary/${id}` : '/')
    } else {
      nav('/session')
    }
  }

  const lastKm = lastRun?.distance_km ? Number(lastRun.distance_km) : null
  const progress = lastKm && km ? Math.min(1, km / lastKm) : 0
  const paceText = pace(seconds, km)
  const shown = km != null ? km.toFixed(2) : '0.00'

  return (
    <div className="screen">
      <header className="topbar">
        <Link to={draft.type === 'run' ? '/' : '/session'} className="iconbtn" aria-label="Back">
          <Icon name="back" />
        </Link>
        <h1 className="topbar-title">
          {draft.type === 'run' ? 'Run' : `${cap(draft.type)} + run`}, {shortDate(todayIST())}
        </h1>
        <span className="topbar-note" aria-live="polite">
          {status === 'saving' ? 'Saving' : status === 'saved' ? 'Saved' : ''}
        </span>
      </header>

      <div className="pad" style={{ paddingTop: '0.25rem' }}>
        <div className="seg" role="group" aria-label="Where did you run">
          <button type="button" className="pill" aria-pressed={mode === 'indoor'} onClick={() => { setMode('indoor'); setDirty(true) }}>
            Indoor
          </button>
          <button type="button" className="pill" aria-pressed={mode === 'outdoor'} onClick={() => { setMode('outdoor'); setDirty(true) }}>
            Outdoor
          </button>
        </div>
      </div>

      <div className="track" style={{ marginTop: '0.875rem' }}>
        <svg role="img" aria-label={lastKm ? `Running track. ${shown} kilometres of last time's ${lastKm.toFixed(2)}.` : `Running track. ${shown} kilometres.`} viewBox="0 0 350 82" preserveAspectRatio="xMidYMid meet">
          <path d="M40 5 H310 A35 35 0 0 1 310 75 H40 A35 35 0 0 1 40 5 Z" fill="none" stroke="var(--rule)" strokeWidth="10" />
          <path d="M40 5 H310 A35 35 0 0 1 310 75 H40 A35 35 0 0 1 40 5 Z" fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={TRACK} strokeDashoffset={TRACK * (1 - progress)} style={{ transition: 'stroke-dashoffset 200ms ease-out' }} />
        </svg>
        <div className="track-text">
          <span className="n">{shown}</span>
          <span className="u"> km</span>
        </div>
      </div>
      <p className="muted" style={{ textAlign: 'center', padding: '0.25rem 1.25rem 0', fontSize: '0.9375rem' }}>
        {lastKm ? `Track fills toward last time: ${lastKm.toFixed(2)} km.` : 'No earlier run to compare with yet.'}
      </p>

      <form className="field-grid" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="r-time">Time (min:sec)</label>
          <input id="r-time" inputMode="numeric" value={time} onChange={numeric(setTime, /^[\d:]{0,8}$/)} placeholder="24:10" aria-invalid={Boolean(timeError)} />
        </div>
        <div className="field">
          <label htmlFor="r-dist">Distance (km)</label>
          <input id="r-dist" inputMode="decimal" value={dist} onChange={numeric(setDist, /^\d{0,3}(\.\d{0,2})?$/)} placeholder="2.40" />
        </div>
        <div className="field">
          <label htmlFor="r-inc">Incline (%)</label>
          <input id="r-inc" inputMode="decimal" value={incline} onChange={numeric(setIncline, /^\d{0,2}(\.\d?)?$/)} placeholder="1.5" />
        </div>
        <div className="field">
          <div className="label muted">Pace, worked out</div>
          <div className="derived">
            {paceText ?? '--:--'}
            <small>/km</small>
          </div>
        </div>
        <div className="field">
          <label htmlFor="r-avg">Average heart rate</label>
          <input id="r-avg" inputMode="numeric" value={avg} onChange={numeric(setAvg, /^\d{0,3}$/)} placeholder="148" />
        </div>
        <div className="field">
          <label htmlFor="r-max">Max heart rate</label>
          <input id="r-max" inputMode="numeric" value={max} onChange={numeric(setMax, /^\d{0,3}$/)} placeholder="171" />
        </div>
        <div className="field wide">
          <label htmlFor="r-str">Structure, optional</label>
          <input id="r-str" className="text" value={structure} onChange={edit(setStructure)} placeholder="5x(4 run/1 walk) at 8 km/h" />
        </div>
        <div className="field wide">
          <label htmlFor="r-rem">Remark, optional</label>
          <input id="r-rem" className="text" value={remark} onChange={edit(setRemark)} placeholder="How did it feel?" />
        </div>
      </form>

      <div className="pad">
        <ErrorLine>{timeError || error}</ErrorLine>
      </div>

      <div className="grow" />
      <div className="pad" style={{ paddingTop: '1rem' }}>
        <button type="button" className="btn-primary plain" onClick={done} disabled={Boolean(timeError)}>
          {draft.type === 'run' ? 'Finish run' : 'Done'}
        </button>
        <CancelSession />
      </div>
    </div>
  )
}
