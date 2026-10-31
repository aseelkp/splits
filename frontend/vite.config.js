import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev the browser talks to Vite (5173) only; /api is forwarded to FastAPI (8000).
// That keeps the login cookie same-origin, exactly like production.
// Set API_TARGET to point the proxy at a backend on another port.
const apiTarget = process.env.API_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': apiTarget },
  },
  test: {
    environment: 'node',
  },
})
