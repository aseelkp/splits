import { useSyncExternalStore } from 'react'

// A tiny persisted store: one JSON value in localStorage, readable from React with a hook.
// localStorage can throw (private windows, blocked storage), so every access is wrapped and the
// app still works from memory without it.

export function createStore(key, initial) {
  const listeners = new Set()
  let value = initial

  try {
    const raw = localStorage.getItem(key)
    if (raw) value = { ...initial, ...JSON.parse(raw) }
  } catch {
    /* start from the default */
  }

  const persist = () => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* keep working in memory */
    }
  }

  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? next(value) : next
      persist()
      listeners.forEach((fn) => fn())
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    use() {
      return useSyncExternalStore(this.subscribe, this.get)
    },
  }
}

/** Like createStore, but the value is `null` when nothing is stored (used for the session draft). */
export function createNullableStore(key) {
  const listeners = new Set()
  let value = null

  try {
    const raw = localStorage.getItem(key)
    if (raw) value = JSON.parse(raw)
  } catch {
    value = null
  }

  const persist = () => {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* keep working in memory */
    }
  }

  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? next(value) : next
      persist()
      listeners.forEach((fn) => fn())
    },
    clear() {
      this.set(null)
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    use() {
      return useSyncExternalStore(this.subscribe, this.get)
    },
  }
}
