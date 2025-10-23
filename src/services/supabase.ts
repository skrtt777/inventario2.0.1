// src/services/supabase.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Permite configurar por:
 * 1) .env Vite (recomendado):
 *    VITE_SUPABASE_URL=...
 *    VITE_SUPABASE_ANON_KEY=...
 * 2) Query string (útil em dev): ?sb_url=...&sb_key=...
 *    — armazena no localStorage para as próximas execuções.
 * 3) Window globals (opcional): window.__SUPABASE_URL__/__SUPABASE_ANON_KEY__
 */

(function seedFromQuery() {
  try {
    const u = new URL(window.location.href);
    const urlQ = u.searchParams.get("sb_url");
    const keyQ = u.searchParams.get("sb_key");
    if (urlQ && keyQ) {
      localStorage.setItem("sb_url", urlQ);
      localStorage.setItem("sb_key", keyQ);
      // opcionalmente remover da URL depois:
      u.searchParams.delete("sb_url");
      u.searchParams.delete("sb_key");
      window.history.replaceState({}, "", u.toString());
    }
  } catch {}
})();

const SB_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  (window as any).__SUPABASE_URL__ ||
  localStorage.getItem("sb_url") ||
  "";

const SB_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (window as any).__SUPABASE_ANON_KEY__ ||
  localStorage.getItem("sb_key") ||
  "";

if (!SB_URL || !SB_ANON_KEY) {
  // Log claro em dev; evita falhas silenciosas (que viram “No API key found…”)
  console.error(
    "[supabase] Faltando configuração. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (ou use ?sb_url=&sb_key=)."
  );
}

export const supabase = createClient(SB_URL, SB_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: { "x-application-name": "inventario-app" },
  },
});

// Utilitário opcional para testar rapidamente a conexão no app
export async function __supabasePing() {
  try {
    const { error } = await supabase.from("concerto").select("*").limit(1);
    if (error) throw error;
    return "OK";
  } catch (e: any) {
    console.error("[supabase ping]", e?.message || e);
    return e?.message || String(e);
  }
}
