// Thin fetch wrapper for the FastAPI backend. Everything lives under /api and the login cookie is
// same-origin (Vite proxies /api in dev; Vercel serves both on one domain), so no CORS or tokens here.

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

const unauthorizedListeners = new Set()
/** Called when any request comes back 401, so the app can show the login screen. */
export const onUnauthorized = (fn) => {
  unauthorizedListeners.add(fn)
  return () => unauthorizedListeners.delete(fn)
}

function messageFrom(detail, status) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ')
  return `Request failed (${status}).`
}

async function request(method, path, body) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/me') unauthorizedListeners.forEach((fn) => fn())
    throw new ApiError(messageFrom(data?.detail, res.status), res.status)
  }
  return data
}

const get = (p) => request('GET', p)
const post = (p, b) => request('POST', p, b)
const patch = (p, b) => request('PATCH', p, b)
const put = (p, b) => request('PUT', p, b)
const del = (p) => request('DELETE', p)

export const api = {
  me: () => get('/api/auth/me'),
  login: (password) => post('/api/auth/login', { password }),
  logout: () => post('/api/auth/logout'),

  sessions: {
    list: (limit = 200) => get(`/api/sessions?limit=${limit}`),
    last: (type) => get(`/api/sessions/last?type=${type}`),
    get: (id) => get(`/api/sessions/${id}`),
    create: (data) => post('/api/sessions', data),
    update: (id, data) => patch(`/api/sessions/${id}`, data),
    remove: (id) => del(`/api/sessions/${id}`),
    addSets: (id, sets) => post(`/api/sessions/${id}/sets`, sets),
    setRun: (id, run) => put(`/api/sessions/${id}/run`, run),
  },
  sets: {
    update: (id, data) => patch(`/api/sets/${id}`, data),
    remove: (id) => del(`/api/sets/${id}`),
  },
  exercises: {
    list: () => get('/api/exercises'),
    get: (id) => get(`/api/exercises/${id}`),
    create: (data) => post('/api/exercises', data),
    history: (id, limit = 500) => get(`/api/exercises/${id}/history?limit=${limit}`),
  },
}
