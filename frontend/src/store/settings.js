import { createStore } from './createStore'

// theme: auto follows the phone. plates: colour (real plate colours) or mono.
export const settings = createStore('splits.settings.v1', { theme: 'auto', plates: 'colour', restSeconds: 120 })

/** Put the settings on <html> so CSS can react to them. Runs at start and on every change. */
export function applySettings() {
  const { theme, plates } = settings.get()
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.plates = plates
}

settings.subscribe(applySettings)
