import { Component, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api, onUnauthorized } from './api'
import { SessionProvider, useSession } from './session/SessionContext'
import ExercisePage from './screens/ExercisePage'
import Exercises from './screens/Exercises'
import Home from './screens/Home'
import Login from './screens/Login'
import Run from './screens/Run'
import Session from './screens/Session'
import Settings from './screens/Settings'
import Summary from './screens/Summary'

// You can only be in a session screen if there is a draft; otherwise go home.
function NeedsDraft({ children }) {
  const { draft } = useSession()
  return draft ? children : <Navigate to="/" replace />
}

// A new screen starts at the top, not wherever the last one was scrolled to.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0) // braces matter: scrollTo can return a Promise, and an effect must not
  }, [pathname])
  return null
}

// If a screen crashes, show a way out instead of a blank page. Logged sets are already saved on the server.
class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app screen pad" style={{ paddingTop: '4rem' }} role="alert">
        <h1 className="home-title">Something broke</h1>
        <p className="muted" style={{ padding: '0.5rem 0 1rem' }}>Anything you already logged is saved. Reload to carry on.</p>
        <button type="button" className="btn-primary plain" onClick={() => window.location.assign('/')}>
          Reload
        </button>
      </main>
    )
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}

function AppInner() {
  const [auth, setAuth] = useState('checking') // checking | in | out | error

  const check = () => {
    setAuth('checking')
    api
      .me()
      .then((r) => setAuth(r.authenticated ? 'in' : 'out'))
      .catch(() => setAuth('error'))
  }

  useEffect(check, [])
  useEffect(() => onUnauthorized(() => setAuth('out')), [])

  if (auth === 'checking') return <main className="app" aria-busy="true"><div className="skeleton" /></main>

  if (auth === 'error') {
    return (
      <main className="app screen pad" style={{ paddingTop: '4rem' }}>
        <h1 className="home-title">Cannot reach the server</h1>
        <p className="muted" style={{ padding: '0.5rem 0 1rem' }}>Check your connection, then try again.</p>
        <button type="button" className="btn-primary plain" onClick={check}>Try again</button>
      </main>
    )
  }

  if (auth === 'out') return <main className="app"><Login onDone={() => setAuth('in')} /></main>

  return (
    <BrowserRouter>
      <SessionProvider>
        <ScrollToTop />
        <main className="app">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/session" element={<NeedsDraft><Session /></NeedsDraft>} />
            <Route path="/run" element={<NeedsDraft><Run /></NeedsDraft>} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/exercises/:id" element={<ExercisePage />} />
            <Route path="/summary/:id" element={<Summary />} />
            <Route path="/settings" element={<Settings onLogout={() => setAuth('out')} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </SessionProvider>
    </BrowserRouter>
  )
}
