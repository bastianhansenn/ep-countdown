import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative base so the build also works on a subpath host (GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
})
