// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://gaagerrdiwscmylxhvqw.supabase.co";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: process.env.VITE_DEV_HOST || "0.0.0.0",
    port: 5173,
    proxy: {
      "/_sb": {
        target: SUPABASE_URL,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/_sb/, ""),
      },
    },
  },
});
