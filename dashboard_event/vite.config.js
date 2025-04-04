import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dashboard_event/',
  build: {
    outDir: '../public/dashboard_event',
    emptyOutDir: true,
    assetsDir: 'images',
  }
})
