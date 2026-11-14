import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Kotlin backend (console/backend). Use the As One access point address
// (http://192.168.12.1:12345) when running on the installation's local
// network, otherwise localhost.
const BACKEND = 'http://localhost:12345'

export default defineConfig({
  // React 16.8 predates the automatic JSX runtime (added in 16.14)
  plugins: [react({ jsxRuntime: 'classic' })],
  resolve: {
    alias: [
      // moment-duration-format (via react-timeseries-charts) does
      // require('moment') and expects the CommonJS export. Vite would
      // otherwise hand it moment's ESM build, where everything sits under
      // `.default`, and the chart module throws on load.
      { find: /^moment$/, replacement: 'moment/moment.js' }
    ]
  },
  server: {
    port: 3000,
    // Every backend REST route lives under one of these prefixes
    proxy: {
      '/sensors': BACKEND,
      '/game': BACKEND
    }
  },
  build: {
    // `make-static` copies this into ../backend/src/main/resources/web-static
    outDir: 'build'
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
})
