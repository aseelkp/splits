import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque/index.css'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'
import { applySettings } from './store/settings'

applySettings()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// A do-nothing service worker: it only makes the app installable on the home screen.
// (Offline mode is out of scope for v1, so nothing is cached.)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
