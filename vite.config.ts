import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { attach } from './server/attach.mjs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'afterglow-api',
      configureServer(server) {
        attach(server.middlewares)
      },
    },
  ],
  server: { port: 5173, strictPort: true },
})
