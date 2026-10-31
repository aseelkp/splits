import { useEffect, useRef, useState } from 'react'
import ErrorLine from '../../components/ErrorLine'
import Sheet from '../../components/Sheet'
import { parseShorthand } from '../../lib/shorthand'
import { formatWeight } from '../../lib/units'
import { useSession } from '../../session/SessionContext'

// Type "40x10, 62.5x2x8". The preview shows what will be saved; the server does the real parsing.
export default function ShorthandSheet({ open, onClose, exercise, startNo }) {
  const { addShorthand, busy, error, setError } = useSession()
  const [text, setText] = useState('')
  const input = useRef(null)

  useEffect(() => {
    if (open) {
      setText('')
      setError('')
    }
  }, [open, setError])

  const { sets, error: parseError } = parseShorthand(text)
  const n = sets.length

  const insert = (chunk) => {
    const el = input.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const next = text.slice(0, start) + chunk + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + chunk.length, start + chunk.length)
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (!n) return
    if (await addShorthand(text)) onClose()
  }

  if (!exercise) return null

  return (
    <Sheet open={open} title="Add by shorthand" onClose={onClose}>
      <form className="sheet-body" onSubmit={submit}>
        <p>
          Adds sets to {exercise.name}, in {exercise.unit}.
        </p>

        <div className="field field-big" style={{ paddingTop: '1rem' }}>
          <label htmlFor="shorthand">Weight x sets x reps, comma separated</label>
          <input id="shorthand" ref={input} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck="false" placeholder="40x10, 62.5x2x8" aria-invalid={Boolean(parseError)} aria-describedby="shorthand-help" autoFocus />
        </div>

        <div id="shorthand-help" aria-live="polite">
          <ErrorLine>{parseError || error}</ErrorLine>
          {n > 0 && (
            <>
              <h2 className="preview-title">
                This will save {n} {n === 1 ? 'set' : 'sets'}
              </h2>
              <div>
                {sets.map((s, i) => (
                  <div className="preview-row" key={i}>
                    <span className="no">{startNo + i}</span>
                    <span className="w">
                      {s.weight == null ? 'BW' : formatWeight(s.weight)}
                      {s.weight != null && <small> {exercise.unit}</small>} x {s.reps}
                    </span>
                    <span className="n" />
                  </div>
                ))}
              </div>
            </>
          )}
          {n === 0 && !parseError && (
            <p style={{ paddingTop: '1rem' }}>
              Examples: <b>35x10</b> is one set. <b>30x2x10</b> is two sets of 10. <b>bwx12</b> is bodyweight.
            </p>
          )}
        </div>

        <div className="quick-keys" role="group" aria-label="Quick keys for the number pad">
          <button type="button" aria-label="Insert x" onClick={() => insert('x')}>
            x
          </button>
          <button type="button" aria-label="Insert comma" onClick={() => insert(', ')}>
            ,
          </button>
          <button type="button" aria-label="Insert decimal point" onClick={() => insert('.')}>
            .
          </button>
          <button type="button" className="wide" aria-label="Insert bodyweight" onClick={() => insert('bw')}>
            bw
          </button>
        </div>

        <button type="submit" className="btn-primary plain" style={{ marginTop: '1rem' }} disabled={!n || busy}>
          {busy ? 'Saving' : n ? `Add ${n} ${n === 1 ? 'set' : 'sets'}` : 'Add sets'}
        </button>
      </form>
    </Sheet>
  )
}
