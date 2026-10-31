import { Link, NavLink } from 'react-router-dom'
import { useSession } from '../session/SessionContext'
import Icon from './Icon'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

// Navigation for wide screens. On a phone it is hidden: the screens carry their own back links.
export default function Rail() {
  const { draft } = useSession()
  return (
    <nav className="rail" aria-label="Main">
      <Link to="/" className="rail-brand">
        splits
      </Link>
      {draft && (
        <Link to={draft.type === 'run' ? '/run' : '/session'} className="rail-resume">
          <span>Session in progress</span>
          <b>Resume {cap(draft.type)}</b>
        </Link>
      )}
      <NavLink to="/" end className="rail-link">
        Home
      </NavLink>
      <NavLink to="/exercises" className="rail-link">
        Exercises
      </NavLink>
      <NavLink to="/settings" className="rail-link">
        <Icon name="settings" size={20} />
        Settings
      </NavLink>
    </nav>
  )
}
