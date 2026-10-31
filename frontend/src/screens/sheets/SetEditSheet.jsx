import { useEffect, useState } from 'react'
import ErrorLine from '../../components/ErrorLine'
import Sheet from '../../components/Sheet'
import { formatWeight, UNIT_NAMES } from '../../lib/units'
import { useSession } from '../../session/SessionContext'

// Fix or remove a set you already logged. Changing the unit only relabels it: the number is not converted.
export default function SetEditSheet({ open, set, onClose }) {
  const { editSet, removeSet } = useSession()
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [unit, setUnit] = useState('kg')
  const [warm, setWarm] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!set) return
    setWeight(set.weight == null ? '' : formatWeight(set.weight))
    setReps(set.reps == null ? '' : String(set.reps))
    setUnit(set.unit)
    setWarm(set.is_warmup)
    setConfirming(false)
    setError('')
  }, [set])

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onClose()
    } catch (e) {
      setError(e.message || 'Could not save that change.')
    } finally {
      setBusy(false)
    }
  }

  const save = (e) => {
    e.preventDefault()
    run(() => editSet(set.id, { weight: weight === '' ? null : Number(weight), reps: reps === '' ? null : Number(reps), unit, is_warmup: warm }))
  }

  if (!set) return <Sheet open={false} onClose={onClose} title="Edit set" />

  return (
    <Sheet open={open} title="Edit set" onClose={onClose}>
      <form className="sheet-body" onSubmit={save}>
        <p>{set.exercise}</p>
        <div className="field-grid" style={{ padding: '0.75rem 0 0' }}>
          <div className="field">
            <label htmlFor="edit-weight">Weight</label>
            <input id="edit-weight" inputMode="decimal" value={weight} onChange={(e) => /^\d{0,4}(\.\d{0,2})?$/.test(e.target.value.replace(',', '.')) && setWeight(e.target.value.replace(',', '.'))} placeholder="BW" />
          </div>
          <div className="field">
            <label htmlFor="edit-reps">Reps</label>
            <input id="edit-reps" inputMode="numeric" value={reps} onChange={(e) => /^\d{0,3}$/.test(e.target.value) && setReps(e.target.value)} />
          </div>
        </div>

        <div className="seg" role="group" aria-label="Unit" style={{ paddingTop: '0.75rem' }}>
          {UNIT_NAMES.map((u) => (
            <button key={u} type="button" className="pill" aria-pressed={unit === u} onClick={() => setUnit(u)}>
              {u}
            </button>
          ))}
        </div>
        {unit !== set.unit && <p style={{ paddingTop: '0.5rem', fontSize: '0.9375rem' }}>This only changes the label. The number stays {weight || 'as it is'}.</p>}

        <div style={{ paddingTop: '0.75rem' }}>
          <button type="button" className="pill" aria-pressed={warm} onClick={() => setWarm((w) => !w)}>
            Warm-up set
          </button>
        </div>

        <ErrorLine>{error}</ErrorLine>

        <button type="submit" className="btn-primary plain" style={{ marginTop: '1rem' }} disabled={busy}>
          {busy ? 'Saving' : 'Save changes'}
        </button>

        <div style={{ paddingTop: '0.5rem', textAlign: 'center' }}>
          {!confirming ? (
            <button type="button" className="link-btn" onClick={() => setConfirming(true)}>
              Delete this set
            </button>
          ) : (
            <div role="alert">
              <p style={{ paddingBottom: '0.25rem', color: 'var(--fg)', fontWeight: 700 }}>Delete this set for good?</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button type="button" className="pill" disabled={busy} onClick={() => run(() => removeSet(set.id))}>
                  Yes, delete
                </button>
                <button type="button" className="pill" onClick={() => setConfirming(false)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  )
}
