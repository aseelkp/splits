import { Link } from 'react-router-dom'
import { api } from '../api'
import Icon from '../components/Icon'
import { settings } from '../store/settings'
import { ROUTINE_TYPES } from './Routine'

const THEMES = [
  ['auto', 'Auto'],
  ['dark', 'Dark'],
  ['light', 'Light'],
]
const PLATES = [
  ['colour', 'Colour'],
  ['mono', 'Mono'],
]
const RESTS = [60, 90, 120, 180]

export default function Settings({ onLogout }) {
  const s = settings.use()
  const set = (changes) => settings.set((cur) => ({ ...cur, ...changes }))

  async function logout() {
    try {
      await api.logout()
    } finally {
      onLogout()
    }
  }

  return (
    <div className="screen">
      <header className="topbar">
        <Link to="/" className="iconbtn" aria-label="Back to home">
          <Icon name="back" />
        </Link>
        <h1 className="topbar-title">Settings</h1>
        <span style={{ width: '3rem' }} />
      </header>

      <div className="list" style={{ paddingTop: '0.5rem' }}>
        <section className="setting">
          <h2>Theme</h2>
          <div className="seg" role="group" aria-label="Theme">
            {THEMES.map(([v, label]) => (
              <button key={v} type="button" className="pill" aria-pressed={s.theme === v} onClick={() => set({ theme: v })}>
                {label}
              </button>
            ))}
          </div>
          <p>Auto follows your phone.</p>
        </section>

        <section className="setting">
          <h2>Plates</h2>
          <div className="seg" role="group" aria-label="Plate colours">
            {PLATES.map(([v, label]) => (
              <button key={v} type="button" className="pill" aria-pressed={s.plates === v} onClick={() => set({ plates: v })}>
                {label}
              </button>
            ))}
          </div>
          <p>Colour uses the usual gym plate colours. Mono keeps them all one tone. Every plate always shows its number.</p>
        </section>

        <section className="setting">
          <h2>Rest between sets</h2>
          <div className="seg" role="group" aria-label="Rest time">
            {RESTS.map((r) => (
              <button key={r} type="button" className="pill" aria-pressed={s.restSeconds === r} onClick={() => set({ restSeconds: r })}>
                {r} s
              </button>
            ))}
          </div>
        </section>

        <section className="setting">
          <h2>Routines</h2>
          <p style={{ paddingTop: 0 }}>The exercises each kind of session starts with. Change them any time.</p>
          <div className="seg wrap" role="group" aria-label="Edit a routine">
            {ROUTINE_TYPES.map((t) => (
              <Link key={t} to={`/routines/${t}`} className="pill">
                {t[0].toUpperCase() + t.slice(1)}
              </Link>
            ))}
          </div>
        </section>

        <section className="setting">
          <h2>Weight units</h2>
          <p style={{ paddingTop: 0 }}>
            Each exercise can be in kg or lbs. Switch it on the set screen. Numbers are saved as typed and are never converted, and bests and charts only compare the same unit.
          </p>
        </section>
      </div>

      <div className="grow" />
      <div className="pad" style={{ paddingTop: '1.25rem' }}>
        <button type="button" className="btn-primary plain" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  )
}
