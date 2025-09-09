// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';

const isLocalHttp =
  typeof window !== 'undefined' &&
  window.location.protocol === 'http:' &&
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(window.location.hostname);

const useProxy = String(import.meta.env.VITE_USE_VITE_PROXY ?? 'true') === 'true';

// 👉 quando usar proxy, transforme "/_sb" em ABSOLUTO:
const proxiedUrl = typeof window !== 'undefined'
  ? `${window.location.origin}/_sb`
  : '/_sb';

const supabaseUrl = (isLocalHttp && useProxy)
  ? proxiedUrl
  : import.meta.env.VITE_SUPABASE_URL!;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    // não enviar cookies, evita SameSite/Lax em http
    fetch: (input, init) =>
      fetch(input as RequestInfo, { ...init, credentials: 'omit' }),
  },
});
