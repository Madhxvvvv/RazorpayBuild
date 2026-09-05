import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Secrets/config live in the repo-root .env.local (see CLAUDE.md), not a
  // separate frontend/.env — only VITE_-prefixed vars are ever exposed to
  // client code, same as Vite's normal .env handling.
  envDir: resolve(__dirname, '..'),
})
