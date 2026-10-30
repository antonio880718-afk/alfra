import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  base: './',   // Required by Capacitor: assets must be relative paths in the native WebView
  build: {
    outDir: 'dist',
  },
})
