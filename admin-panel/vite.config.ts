import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dukanchi admin panel — separate Vite SPA from the customer app.
//
// Dev port: 5174 (customer app uses 5173 by Vite default).
//   - strictPort: true prevents silent fallback to 5175 etc. — better to
//     fail loudly so the developer notices a stale process before continuing.
//   - Day 7 / Session 94 / ND-D7-2: moved from 5173 to 5174 to resolve the
//     "/admin-panel/login -> /login" dev confusion (which was actually
//     customer-app's React Router rejecting unknown /admin-panel/* paths
//     when both apps tried to bind 5173).
//
// Prod: this app is built into admin-panel/dist/ and served by Express at
// /admin-panel/* (src/app.ts:236-241). The `base: '/admin-panel/'` ensures
// asset URLs in the prod bundle reference the subpath correctly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/admin-panel/',
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
