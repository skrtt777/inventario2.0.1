// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gaagerrdiwscmylxhvqw.supabase.co'

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_DEV_HOST || '0.0.0.0',
    port: 5173,
    proxy: {
      '/_sb': {
        target: SUPABASE_URL,
        changeOrigin: true,
        secure: true,
        // tira o prefixo "/_sb" antes de encaminhar
        rewrite: (p) => p.replace(/^\/_sb/, ''),
      },
    },
  },
})
