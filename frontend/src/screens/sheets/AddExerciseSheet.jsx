import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import ErrorLine from '../../components/ErrorLine'
import Icon from '../../components/Icon'
import Sheet from '../../components/Sheet'
import { UNIT_NAMES } from '../../lib/units'
import { useSession } from '../../session/SessionContext'

export const CATEGORY_COLOR = { push: 'green', pull: 'blue', legs: 'yellow', core: 'red', other: 'silver' }

// Search the exercises you already have first, so "Bench press" does not become "Barbell bench".
// Creating a new one is the last option; the server makes it when the first set is saved.
export default function AddExerciseSheet({ open, onClose }) {
  const { addExercise } = useSession()
  const [list, setList] = useState(null)
  const [query, setQuery] = useState('')
  const [unit, setUnit] = useState('kg')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    setError('')
    api.exercises
      .list()
      .then(setList)
      .catch(() => setError('Could not load your exercises. You can still type a new name.'))
  }, [open])

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => (list ?? []).filter((e) => !q || e.name.toLowerCase().includes(q)).slice(0, 30), [list, q])
  const exact = (list ?? []).some((e) => e.name.toLowerCase() === q)

  async function pick(name, u) {
    await addExercise({ name, unit: u })
    onClose()
  }

  return (
    <Sheet open={open} title="Add exercise" onClose={onClose}>
      <div className="sheet-body">
        <div className="field field-big" style={{ paddingTop: '0.75rem' }}>
          <label htmlFor="exercise-search">Search, or type a new name</label>
          <input id="exercise-search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" autoFocus />
        </div>
        <ErrorLine>{error}</ErrorLine>

        {list && (
          <h2 className="preview-title" style={{ color: 'var(--muted)' }} aria-live="polite">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </h2>
        )}
        <div>
          {matches.map((e) => (
            <button key={e.id} type="button" className="pick" onClick={() => pick(e.name, e.default_unit)}>
              <span className={`cat-disc plate-${CATEGORY_COLOR[e.category]}`} aria-hidden="true">
                {e.category.slice(0, 2).replace(/^./, (c) => c.toUpperCase())}
              </span>
              <span className="t">
                <b>{e.name}</b>
                <span>
                  {e.category[0].toUpperCase() + e.category.slice(1)}, {e.default_unit}
                </span>
              </span>
            </button>
          ))}
        </div>

        {q && !exact && (
          <div className="create-box">
            <div className="row">
              <span className="plus">
                <Icon name="plus" stroke={3} />
              </span>
              <span className="label">Create "{query.trim()}" as new</span>
            </div>
            <div className="unit-row" role="group" aria-label="Unit for the new exercise">
              <span className="muted" style={{ fontWeight: 600 }}>Unit</span>
              <div className="seg small">
                {UNIT_NAMES.map((u) => (
                  <button key={u} type="button" className="pill" aria-pressed={unit === u} onClick={() => setUnit(u)}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="btn-primary plain" style={{ marginTop: '0.875rem', minHeight: '3.5rem', fontSize: '1.25rem' }} onClick={() => pick(query.trim(), unit)}>
              Add {query.trim()}
            </button>
          </div>
        )}

        <p className="muted" style={{ paddingTop: '1rem', fontSize: '0.9375rem' }}>Tip: reuse an existing name when you can, so history stays in one place.</p>
      </div>
    </Sheet>
  )
}
