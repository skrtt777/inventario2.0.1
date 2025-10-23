import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

export type ListState = {
  page: number;
  pageSize: number;
  q?: string;
  sort?: string;
  filters?: string; // pode ser JSON.stringify({...}) se quiser algo mais complexo
};

export function useListURLState(storageKey: string, defaults: ListState) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();

  const state: ListState = {
    page: Number(params.get("page") ?? defaults.page),
    pageSize: Number(params.get("pageSize") ?? defaults.pageSize),
    q: params.get("q") ?? defaults.q,
    sort: params.get("sort") ?? defaults.sort,
    filters: params.get("filters") ?? defaults.filters,
  };

  // Restaura e salva posição de scroll (opcional)
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const obj = JSON.parse(saved);
        if (typeof obj.scrollY === "number") {
          requestAnimationFrame(() => window.scrollTo(0, obj.scrollY));
        }
      } catch {}
    }
    return () => {
      sessionStorage.setItem(storageKey, JSON.stringify({ scrollY: window.scrollY }));
    };
  }, [storageKey]);

  const update = (patch: Partial<ListState>, replace = true) => {
    const next = { ...state, ...patch };
    const nextParams = new URLSearchParams();
    nextParams.set("page", String(next.page));
    nextParams.set("pageSize", String(next.pageSize));
    if (next.q) nextParams.set("q", next.q);
    if (next.sort) nextParams.set("sort", next.sort);
    if (next.filters) nextParams.set("filters", next.filters);
    setParams(nextParams, { replace });
  };

  // string pronta para anexar em links: `?page=...&pageSize=...`
  const search = `?${params.toString()}`;

  return { state, update, search, location };
}
