import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// The app is 100% client-side: no backend, no file uploads.
// `vite build` produces a static site (dist/) that can be hosted anywhere.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2200,
  },
})
