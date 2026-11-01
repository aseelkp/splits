import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import ErrorLine from '../components/ErrorLine'
import Icon from '../components/Icon'

export const ROUTINE_TYPES = ['push', 'pull', 'lower', 'upper', 'other']
const cap = (s) => s[0].toUpperCase() + s.slice(1)
const MAX_SETS = 20

// Edit the exercise list a kind of session starts with. Nothing is saved until you press Save.
export default function Routine() {
  const { type } = useParams()
  if (!ROUTINE_TYPES.includes(type)) return <Navigate to="/settings" replace />
  return <Editor key={type} type={type} />
}

function Editor({ type }) {
  const [saved, setSaved] = useState(null) // what the server has: { saved, items } or null while loading
  const [items, setItems] = useState([]) // [{ name, target }] (target null = same as last time)
  const [known, setKnown] = useState([]) // exercise names, for suggestions
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const toItems = (r) => r.items.map((i) => ({ name: i.exercise, target: i.target_sets }))

  useEffect(() => {
    let off = false
    Promise.all([api.routines.get(type), api.exercises.list()])
      .then(([r, list]) => {
        if (off) return
        setSaved(r)
        setItems(toItems(r))
        setKnown(list.map((e) => e.name))
      })
      .catch((e) => !off && setError(e instanceof ApiError ? e.message : 'Could not load this routine.'))
    return () => {
      off = true
    }
  }, [type])

  const dirty = useMemo(() => saved !== null && JSON.stringify(items) !== JSON.stringify(toItems(saved)), [items, saved])
  const edit = (fn) => {
    setJustSaved(false)
    setItems(fn)
  }

  const move = (i, by) =>
    edit((cur) => {
      const next = [...cur]
      ;[next[i], next[i + by]] = [next[i + by], next[i]]
      return next
    })
  const remove = (i) => edit((cur) => cur.filter((_, k) => k !== i))
  // Auto (null) -> 1 .. MAX_SETS, and below 1 goes back to Auto.
  const step = (i, by) =>
    edit((cur) =>
      cur.map((it, k) => {
        if (k !== i) return it
        const now = it.target ?? 0
        const next = now + by
        return { ...it, target: next < 1 ? null : Math.min(MAX_SETS, next) }
      }),
    )

  const name = draftName.trim().replace(/\s+/g, ' ')
  const already = items.some((it) => it.name.toLowerCase() === name.toLowerCase())
  const suggestions = known.filter((n) => !items.some((it) => it.name.toLowerCase() === n.toLowerCase()))

  function add(e) {
    e.preventDefault()
    if (!name || already) return
    // Use the spelling of an exercise you already have, so "bench press" does not become a second exercise.
    const match = known.find((n) => n.toLowerCase() === name.toLowerCase())
    edit((cur) => [...cur, { name: match ?? name, target: null }])
    setDraftName('')
  }

  async function persist(next, resetting) {
    setBusy(true)
    setError('')
    try {
      const r = await api.routines.set(type, next.map((it) => ({ exercise: it.name, target_sets: it.target })))
      setSaved(r)
      setItems(toItems(r))
      setJustSaved(!resetting)
      setConfirmReset(false)
      if (resetting) setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const label = cap(type)
  const note =
    saved === null
      ? ''
      : saved.saved
        ? `Saved. A new ${type} session starts with this list.`
        : items.length
          ? `No routine saved yet. This is your last ${type} session. Save it to make it the plan, or change it first.`
          : `No ${type} session yet. Add the exercises you want and save.`

  return (
    <div className="screen">
      <header className="topbar">
        <Link to="/settings" className="iconbtn" aria-label="Back to settings">
          <Icon name="back" />
        </Link>
        <h1 className="topbar-title">{label} routine</h1>
        <span style={{ width: '3rem' }} />
      </header>

      <p className="rt-note" role="status">
        {note}
      </p>
      <ErrorLine>{error}</ErrorLine>

      {saved === null && !error && <div className="skeleton" aria-hidden="true" />}

      {saved !== null && (
        <>
          {items.length > 0 && (
            <ol className="list rt-list" aria-label={`${label} routine`}>
              {items.map((it, i) => (
                <li key={it.name} className="rt-row">
                  <span className="rt-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="rt-name">{it.name}</span>
                  <span className="rt-sets" role="group" aria-label={`Sets for ${it.name}`}>
                    <button type="button" className="iconbtn" aria-label={`Fewer sets for ${it.name}`} onClick={() => step(i, -1)} disabled={it.target === null}>
                      <Icon name="minus" size={20} />
                    </button>
                    <span className="rt-val">{it.target === null ? 'Same as last time' : `${it.target} ${it.target === 1 ? 'set' : 'sets'}`}</span>
                    <button type="button" className="iconbtn" aria-label={`More sets for ${it.name}`} onClick={() => step(i, 1)} disabled={it.target === MAX_SETS}>
                      <Icon name="plus" size={20} />
                    </button>
                  </span>
                  <span className="rt-move">
                    <button type="button" className="iconbtn" aria-label={`Move ${it.name} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                      <Icon name="up" size={20} />
                    </button>
                    <button type="button" className="iconbtn" aria-label={`Move ${it.name} down`} onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                      <Icon name="down" size={20} />
                    </button>
                    <button type="button" className="iconbtn" aria-label={`Remove ${it.name}`} onClick={() => remove(i)}>
                      <Icon name="close" size={20} />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <form className="rt-add" onSubmit={add}>
            <div className="field field-big">
              <label htmlFor="rt-new">Add an exercise</label>
              <input id="rt-new" className="text" list="rt-known" value={draftName} onChange={(e) => setDraftName(e.target.value)} autoComplete="off" placeholder="Bench press" />
              <datalist id="rt-known">
                {suggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <button type="submit" className="pill" disabled={!name || already}>
              <Icon name="plus" size={18} />
              Add
            </button>
          </form>
          {already && <p className="rt-note">{name} is already in this routine.</p>}

          <div className="grow" />
          <div className="pad" style={{ paddingTop: '1rem' }}>
            <button type="button" className="btn-primary plain" onClick={() => persist(items, false)} disabled={busy || (saved.saved && !dirty) || items.length === 0}>
              {busy ? 'Saving' : justSaved ? 'Saved' : 'Save routine'}
            </button>
            {saved.saved && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.25rem' }}>
                {!confirmReset ? (
                  <button type="button" className="link-btn" onClick={() => setConfirmReset(true)}>
                    Follow my last {type} session instead
                  </button>
                ) : (
                  <div role="alert" style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 700, paddingBottom: '0.375rem' }}>Remove this saved routine? Your logged sets are not touched.</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button type="button" className="pill" onClick={() => persist([], true)} disabled={busy}>
                        Yes, remove it
                      </button>
                      <button type="button" className="pill" onClick={() => setConfirmReset(false)} disabled={busy}>
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
