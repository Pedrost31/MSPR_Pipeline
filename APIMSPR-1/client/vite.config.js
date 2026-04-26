import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth':                 'http://localhost:3000',
      '/aliment':              'http://localhost:3000',
      '/utilisateurs':         'http://localhost:3000',
      '/consommation':         'http://localhost:3000',
      '/activite_quotidienne': 'http://localhost:3000',
      '/analytics':            'http://localhost:3000',
    }
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
  }
})
