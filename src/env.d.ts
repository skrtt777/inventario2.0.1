/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string
  // adicione aqui outras variáveis se precisar
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
