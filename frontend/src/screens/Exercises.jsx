import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api'
import ErrorLine from '../components/ErrorLine'
import Icon from '../components/Icon'
import { CATEGORY_COLOR } from './sheets/AddExerciseSheet'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

export default function Exercises() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    api.exercises
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your exercises.'))
  }, [])

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (list ?? []).filter((e) => !q || e.name.toLowerCase().includes(q)), [list, q])

  return (
    <div className="screen">
      <header className="topbar">
        <Link to="/" className="iconbtn" aria-label="Back to home">
          <Icon name="back" />
        </Link>
        <h1 className="topbar-title">Exercises</h1>
        <span style={{ width: '3rem' }} />
      </header>

      <div className="search field field-big">
        <label htmlFor="ex-search">Search your exercises</label>
        <input id="ex-search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>
      <ErrorLine>{error}</ErrorLine>

      {list === null && !error && <div className="skeleton" aria-hidden="true" />}
      {list && list.length === 0 && <p className="empty">No exercises yet. They appear here once you log your first set.</p>}
      {list && list.length > 0 && shown.length === 0 && <p className="empty">Nothing matches "{query}".</p>}
      {shown.length > 0 && (
        <div className="list" style={{ paddingTop: '1rem' }}>
          {shown.map((e) => (
            <Link key={e.id} to={`/exercises/${e.id}`} className="pick" style={{ textDecoration: 'none', color: 'inherit', borderBottom: 0 }}>
              <span className={`cat-disc plate-${CATEGORY_COLOR[e.category]}`} aria-hidden="true">
                {cap(e.category).slice(0, 2)}
              </span>
              <span className="t">
                <b>{e.name}</b>
                <span>
                  {cap(e.category)}, {e.default_unit}
                </span>
              </span>
              <Icon name="forward" size={20} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
