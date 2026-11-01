import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api'
import { useSession } from '../session/SessionContext'
import ErrorLine from './ErrorLine'

/**
 * "Cancel session": throw the in-progress session away.
 * Nothing logged yet: just forget it. Sets already saved: ask first, because this deletes them.
 */
export default function CancelSession() {
  const nav = useNavigate()
  const { draft, session, cancelSession } = useSession()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const saved = session?.sets?.length ?? 0
  const hasSaved = Boolean(draft?.sessionId)

  async function discard() {
    setBusy(true)
    setError('')
    try {
      await cancelSession()
      nav('/', { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not cancel this session. Try again.')
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.25rem' }}>
        <button type="button" className="link-btn" onClick={() => (hasSaved ? setConfirming(true) : discard())} disabled={busy}>
          Cancel session
        </button>
        <ErrorLine>{error}</ErrorLine>
      </div>
    )
  }

  return (
    <div role="alert" style={{ textAlign: 'center', paddingTop: '0.25rem' }}>
      <p style={{ fontWeight: 700, paddingBottom: '0.375rem' }}>
        {saved > 0 ? `Discard this session and its ${saved} logged ${saved === 1 ? 'set' : 'sets'}?` : 'Discard this session?'}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
        <button type="button" className="pill" onClick={discard} disabled={busy}>
          {busy ? 'Discarding' : 'Yes, discard'}
        </button>
        <button type="button" className="pill" onClick={() => setConfirming(false)} disabled={busy}>
          Keep it
        </button>
      </div>
      <ErrorLine>{error}</ErrorLine>
    </div>
  )
}
