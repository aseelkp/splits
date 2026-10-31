import { useState } from 'react'
import { api, ApiError } from '../api'
import ErrorLine from '../components/ErrorLine'
import Icon from '../components/Icon'

function Logo() {
  const plate = (x, y, w, h, color, mirror) => (
    <rect x={mirror ? 164 - x - w : x} y={y} width={w} height={h} rx="4" fill={`var(--plate-${color})`} stroke="var(--edge)" strokeWidth="2" />
  )
  return (
    <svg role="img" aria-label="splits logo: a barbell with plates" width="164" height="68" viewBox="0 0 164 68">
      <rect x="0" y="31" width="164" height="6" rx="3" fill="var(--muted)" />
      {[false, true].map((m) => (
        <g key={String(m)}>
          {plate(28, 2, 14, 64, 'blue', m)}
          {plate(44, 14, 11, 40, 'green', m)}
          {plate(57, 22, 8, 24, 'white', m)}
        </g>
      ))}
    </svg>
  )
}

export default function Login({ onDone }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.login(password)
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("That password didn't work. Try again.")
      else if (err instanceof ApiError && err.status === 503) setError('Login is not set up on the server yet. Set APP_PASSWORD and SESSION_SECRET.')
      else setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen login">
      <div className="login-brand">
        <Logo />
        <h1 className="wordmark">splits</h1>
        <p className="muted" style={{ paddingTop: '0.625rem', fontSize: '1.125rem' }}>Plates on. Let's go.</p>
      </div>

      <form className="login-form" onSubmit={submit}>
        <div className="field field-big">
          <label htmlFor="pw">Password</label>
          <div className="password-wrap">
            <input id="pw" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
            <button type="button" className="link-btn" aria-pressed={show} onClick={() => setShow((s) => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <ErrorLine>{error}</ErrorLine>
        <button type="submit" className="btn-primary" style={{ marginTop: '1.625rem' }} disabled={busy || !password}>
          {busy ? 'Unlocking' : 'Unlock'}
          <span className="arrow">
            <Icon name="arrow" stroke={2.6} />
          </span>
        </button>
      </form>

      <div className="grow" />
      <p className="muted" style={{ textAlign: 'center', fontSize: '0.9375rem' }}>Just for you. No account, no sign-up.</p>
    </div>
  )
}
