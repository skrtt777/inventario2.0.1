// src/components/TableBrowser.tsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useLocation } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../services/supabase";
import { useListURLState } from "../hooks/useListURLState";
import TableBrowserLayout from "../pages/TableBrowserLayout";

/** ===== Tipos ===== */
type Row = Record<string, any>;
type TableMeta = { schemaname: string; tablename: string };

type Unit = "mm" | "px";
type ExtraMode = "text" | "column";
type ScalarType = "text" | "number" | "boolean" | "date" | "unknown";

type TextOp =
  | "contains"
  | "not_contains"
  | "equals"
  | "neq"
  | "starts_with"
  | "ends_with"
  | "in"
  | "null"
  | "not_null";
type NumOp =
  | "equals"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "in"
  | "null"
  | "not_null";
type DateOp = "on" | "before" | "after" | "between" | "null" | "not_null";
type BoolOp = "is_true" | "is_false" | "null" | "not_null";
type AnyOp = TextOp | NumOp | DateOp | BoolOp;

interface Condition {
  id: string;
  column: string;
  op: AnyOp;
  value?: string;
  value2?: string;
}

interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

interface ColumnMeta {
  name: string;
  type: ScalarType;
}

interface LabelSettings {
  unit: Unit;
  width: number;
  height: number;
  margin: number;
  qrSize: number;
  fontSize: number;
  lineHeight: number;
  qrPlacement: "left" | "right" | "top";
  showName: boolean;
  showId: boolean;
  showInventory: boolean;
  showUrl: boolean;
  // mapeamento
  nameField: string;
  idField: string;
  inventoryField: string;
  // extras
  extra1Mode: ExtraMode;
  extra1Text: string;
  extra1Column: string;
  extra2Mode: ExtraMode;
  extra2Text: string;
  extra2Column: string;
}

/** ===== Constantes ===== */
const DEFAULT_SETTINGS: LabelSettings = {
  unit: "mm",
  width: 60,
  height: 40,
  margin: 4,
  qrSize: 24,
  fontSize: 3.2,
  lineHeight: 1.25,
  qrPlacement: "left",
  showName: true,
  showId: true,
  showInventory: true,
  showUrl: false,
  nameField: "",
  idField: "",
  inventoryField: "",
  extra1Mode: "text",
  extra1Text: "",
  extra1Column: "",
  extra2Mode: "text",
  extra2Text: "",
  extra2Column: "",
};

const SETTINGS_KEY = "labelSettingsV3";
const ACTIONS_COL_KEY = "__actions__";
const VIEW_MODE_KEY = "tableBrowserViewModeV1";
// Prefer explicit public base; in dev, fall back to LAN host if provided
const DEV_HOST = (import.meta as any)?.env?.VITE_DEV_HOST;
const DEV_PORT = (import.meta as any)?.env?.VITE_DEV_PORT || 5173;
const BASE_URL =
  (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL ||
  (DEV_HOST ? `http://${DEV_HOST}:${DEV_PORT}` : window.location.origin);
const maskValue = (value?: string | null) => {
  if (!value) return "null";
  const normalized = String(value);
  if (normalized.length <= 12) return normalized;
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
};

const getBrowserDebugContext = (): string[] => {
  const lines: string[] = [];
  if (typeof window !== "undefined") {
    try {
      lines.push(`origin=${window.location.origin}`);
      lines.push(`pathname=${window.location.pathname}`);
    } catch {}
  }
  if (typeof navigator !== "undefined") {
    try {
      lines.push(`online=${navigator.onLine}`);
      lines.push(`userAgent=${navigator.userAgent}`);
    } catch {}
  }
  return lines;
};

const getSupabaseDebugContext = (): string[] => {
  const lines: string[] = [];
  try {
    const env = (import.meta as any)?.env ?? {};
    lines.push(`envUrl=${env?.VITE_SUPABASE_URL || "null"}`);
    lines.push(`envKey=${maskValue(env?.VITE_SUPABASE_ANON_KEY ?? null)}`);
  } catch {
    lines.push("envUrl=error");
    lines.push("envKey=error");
  }
  if (typeof window !== "undefined") {
    const w = window as any;
    try {
      lines.push(`globalUrl=${w.__SUPABASE_URL__ || "null"}`);
      lines.push(`globalKey=${maskValue(w.__SUPABASE_ANON_KEY__ ?? null)}`);
    } catch {}
    try {
      const lsUrl = window.localStorage?.getItem("sb_url") ?? null;
      const lsKey = window.localStorage?.getItem("sb_key") ?? null;
      lines.push(`localUrl=${lsUrl || "null"}`);
      lines.push(`localKey=${maskValue(lsKey)}`);
    } catch {
      lines.push("localStorage=unavailable");
    }
  }
  try {
    const restUrl =
      (supabase as any)?.restUrl ??
      (supabase as any)?.rest?.url ??
      (supabase as any)?._restUrl ??
      null;
    lines.push(`clientRestUrl=${restUrl || "null"}`);
  } catch {
    lines.push("clientRestUrl=error");
  }
  return lines;
};

/* ======================= helpers ======================= */
const typeGuess = (v: any): ScalarType => {
  if (v === null || v === undefined) return "unknown";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?/.test(v)) return "date";
    if (!isNaN(Number(v)) && v.trim() !== "") return "number";
    return "text";
  }
  return "unknown";
};

const getField = (r: Row | null, field?: string) => {
  if (!r || !field) return "";
  const tryVal = (k: string) => {
    const v = (r as any)[k];
    return v != null && String(v).trim() !== "" ? v : "";
  };
  return (
    tryVal(field) || tryVal(field.toLowerCase()) || tryVal(field.toUpperCase()) || ""
  );
};

const resolveField = (r: Row, preferred: string, candidates: string[]) => {
  let v = getField(r, preferred);
  if (v !== "") return v;
  for (const c of candidates) {
    v = getField(r, c);
    if (v !== "") return v;
  }
  return "";
};

/** Retorna a 1Âª coluna do row que tenha um valor nÃ£o-vazio. */
function pickFirstField(row: Row, candidates: string[]): string {
  for (const c of candidates) {
    const v = getField(row, c);
    if (v !== "") return String(v);
  }
  return "";
}

/** Busca fuzzy: acha 1Âª coluna cujo nome contenha algum dos termos. */
function resolveFieldFuzzy(row: Row, terms: string[]): string {
  const keys = Object.keys(row || {});
  const lc = keys.map((k) => k.toLowerCase());
  for (const t of terms) {
    const ti = lc.findIndex((k) => k.includes(t.toLowerCase()));
    if (ti >= 0) {
      const v = (row as any)[keys[ti]];
      if (v != null && String(v).trim() !== "") return String(v);
    }
  }
  return "";
}

/** ID robusto */
function resolveIdSmart(row: Row, explicit?: string): string {
  let v = explicit ? getField(row, explicit) : "";
  if (v !== "") return String(v);

  v = pickFirstField(row, [
    "id",
    "ID",
    "Id",
    "iD",
    "uuid",
    "guid",
    "codigo",
    "cÃ³digo",
    "cod",
    "asset_id",
    "assetId",
    "idinventario",
    "id_inventario",
    "tombo",
    "patrimonio",
    "patrimÃ´nio",
  ]);
  if (v !== "") return String(v);

  const keys = Object.keys(row || {});
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (lk === "id" || lk.startsWith("id_")) {
      const vv = (row as any)[k];
      if (vv != null && String(vv).trim() !== "") return String(vv);
    }
  }
  for (const k of keys) {
    const vv = (row as any)[k];
    const s = vv == null ? "" : String(vv).trim();
    if (!s) continue;
    const looksUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        s
      );
    const looksBigInt = /^\d{4,}$/.test(s);
    if (looksUUID || looksBigInt) return s;
  }
  return String((row as any)?.id ?? (row as any)?.ID ?? "") || "";
}

function resolveIdKeyFromRow(row: Row): string {
  const idVal = resolveIdSmart(row);
  const keys = Object.keys(row || {});
  for (const k of keys) {
    const v = (row as any)[k];
    if (v == null) continue;
    if (String(v) === String(idVal)) return k;
  }
  const exact = keys.find((k) => ["id", "ID", "Id", "iD"].includes(k));
  if (exact) return exact;
  const starts = keys.find(
    (k) => k.toLowerCase() === "id" || k.toLowerCase().startsWith("id_")
  );
  if (starts) return starts;
  return "id";
}

function resolveStatusKeyFromRow(row: Row): string {
  const keys = Object.keys(row || {});
  const hit =
    keys.find((k) => k.toLowerCase().includes("status")) ||
    keys.find((k) => k.toLowerCase().includes("situac")) ||
    keys.find((k) => k.toLowerCase().includes("state"));
  return hit || "status";
}

const HIDDEN_TABLES = new Set<string>(["concerto", "concertos"]);
const makeAnchorId = (raw: string | number) =>
  `r-${String(raw).trim().replace(/[^A-Za-z0-9_.:-]/g, "-")}`;

function todayLocalISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/* ===================================================================== */
export default function TableBrowser({
  initialSearch = "",
  initialTable = "",
  initialSearchTable = true,
  autopickFirstTable = false,
}: {
  initialSearch?: string;
  initialTable?: string;
  initialSearchTable?: boolean;
  autopickFirstTable?: boolean;
}) {
  const location = useLocation();

  // ======== ESTADO NA URL ========
  const { state: urlState, update: updateURL, search: urlSearch } = useListURLState(
    "table_browser_list_v1",
    { page: 1, pageSize: 100, q: initialSearch || "", sort: "", filters: "" }
  );
  const page = urlState.page;
  const pageSize = urlState.pageSize;

  // Estado principal
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [table, setTable] = useState<string>(initialTable);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState<number>(0);
  const [allRowsState, setAllRowsState] = useState<{ table: string; rows: Row[] } | null>(null);
  const [allRowsLoading, setAllRowsLoading] = useState(false);
  const [allRowsError, setAllRowsError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca global client-side (espelhada com URL q)
  const [globalSearch, setGlobalSearch] = useState(urlState.q || "");
  useEffect(() => {
    setGlobalSearch(urlState.q || "");
  }, [urlState.q]);
  const trimmedSearch = globalSearch.trim();
  const hasSearch = trimmedSearch.length > 0;

  // OrdenaÃ§Ã£o
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  useEffect(() => {
    if (!urlState.sort) return;
    try {
      const parsed = JSON.parse(urlState.sort) as SortConfig;
      if (parsed?.column && (parsed.direction === "asc" || parsed.direction === "desc")) {
        setSortConfig(parsed);
      }
    } catch {}
  }, []);

  // UI
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Export dropdown anchor
  const exportRef = useRef<HTMLDivElement | null>(null);
  // Controle para ajuste automÃ¡tico de pageSize conforme o monitor
  const autoPageRef = useRef<{ manual: boolean; timer: number | null }>({ manual: false, timer: null });

  // Designer / ImpressÃ£o
  const [qrForPrint, setQrForPrint] = useState<{ url: string; row: Row } | null>(null);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [designerRow, setDesignerRow] = useState<Row | null>(null);

  const [settings, setSettings] = useState<LabelSettings>(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window === 'undefined') return 'table';
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_KEY);
      if (stored === 'cards' || stored === 'table') return stored as 'table' | 'cards';
    } catch {}
    return typeof window !== 'undefined' && window.innerWidth < 1280 ? 'cards' : 'table';
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  // ======== Filtro simples ========
  const [simpleDraft, setSimpleDraft] = useState<Condition>({
    id: "simple",
    column: "",
    op: "contains",
    value: "",
    value2: "",
  });
  const [simpleApplied, setSimpleApplied] = useState<Condition | null>(null);

  // Restaura filtro simples salvo na URL
  useEffect(() => {
    if (!urlState.filters) return;
    try {
      const parsed = JSON.parse(urlState.filters);
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
        const restored: Condition = {
          id: "simple",
          column: parsed.column || "",
          op: parsed.op || "contains",
          value: parsed.value || "",
          value2: parsed.value2 || "",
        };
        setSimpleDraft(restored);
        setSimpleApplied(restored);
      }
    } catch {}
  }, []);

  // ancorar ao hash
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.classList.add("highlight-row");
        setTimeout(() => el.classList.remove("highlight-row"), 900);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [location.hash, rows.length]);

  // ImpressÃ£o (gera HTML + abre janela)
  useEffect(() => {
    if (!qrForPrint) return;
    const t = setTimeout(() => {
      const canvas = document.getElementById("print-qr") as HTMLCanvasElement | null;
      if (!canvas) {
        setQrForPrint(null);
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      const unit = settings.unit;
      const pageW = `${settings.width}${unit}`;
      const pageH = `${settings.height}${unit}`;
      const margin = `${settings.margin}${unit}`;
      const qrSide = `${settings.qrSize}${unit}`;
      const fontSize = `${settings.fontSize}${unit}`;
      const lines = makeLines(qrForPrint.row, qrForPrint.url, settings);

      const placementClass =
        settings.qrPlacement === "top"
          ? " label--top"
          : settings.qrPlacement === "right"
          ? " label--right"
          : "";
      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Etiqueta</title>
<style>
@media print { @page { size: ${pageW} ${pageH}; margin: ${margin}; } body { margin: 0; } }
body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial; }
.label { display:flex; align-items:center; gap:${unit === "mm" ? "2mm" : "8px"}; padding:${unit === "mm" ? "1mm" : "4px"}; }
.label--top { flex-direction:column; align-items:center; text-align:center; }
.label--right { flex-direction:row-reverse; }
.qr { width:${qrSide}; height:${qrSide}; }
.t { font-size:${fontSize}; line-height:${settings.lineHeight}; }
.label--top .t { text-align:center; }
.t strong { font-size: calc(${fontSize} * 1.05); }
.small { font-size: calc(${fontSize} * 0.85); color:#333; word-break:break-all; display:block; }
</style>
</head>
<body onload="window.print(); setTimeout(()=>window.close(), 600);">
  <div class="label${placementClass}">
    <img class="qr" src="${dataUrl}" alt="QR"/>
    <div class="t">
      ${lines.map((l) => `<div>${l}</div>`).join("")}
    </div>
  </div>
</body>
</html>`;

      const w = window.open("", "_blank", "width=520,height=660");
      if (!w) {
        setQrForPrint(null);
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      setQrForPrint(null);
    }, 40);
    return () => clearTimeout(t);
  }, [qrForPrint, settings]);

  // Carrega nomes das tabelas
  useEffect(() => {
    (async () => {
      try {
        setLoadingTables(true);
        setError(null);

        let { data, error } = await supabase
          .schema("api")
          .from("tabelas_disponiveis")
          .select("*");

        if (error) {
          const rpc = await supabase.rpc("list_tables" as any);
          data = (rpc.data as TableMeta[]) ?? null;
          error = rpc.error as any;
        }
        if (error) throw error;

        // Filtra apenas schema public e oculta tabelas indesejadas
        const publicTables = (data ?? [])
          .filter((t) => t.schemaname?.toLowerCase() === "public")
          .filter((t) => !HIDDEN_TABLES.has(String(t.tablename || "").toLowerCase()));
        const dedup = Array.from(
          new Map(publicTables.map((t) => [t.tablename, t])).values()
        ).sort((a, b) => a.tablename.localeCompare(b.tablename));

        setTables(dedup);

        if (!initialTable && autopickFirstTable && dedup[0]) {
          const clean = dedup[0].tablename.replace(/^public\./i, "");
          setTable(clean);
        }
      } catch (e: any) {
        console.error("[TableBrowser] Falha ao listar tabelas", e);
        const msg =
          e?.message ||
          e?.error_description ||
          e?.hint ||
          e?.details ||
          JSON.stringify(e);
        const debugLines: string[] = [
          "--- debug:listTables ---",
          `ts=${new Date().toISOString()}`,
          `initialTable=${initialTable || "(empty)"}`,
          `autopickFirstTable=${autopickFirstTable}`,
          `errorName=${e?.name || typeof e}`,
        ];
        if (e?.stack) {
          const stackHead = String(e.stack).split("\n").slice(0, 2).join(" | ");
          debugLines.push(`stackHead=${stackHead}`);
        }
        debugLines.push(...getBrowserDebugContext());
        debugLines.push(...getSupabaseDebugContext());
        setError(
          `Falha ao listar tabelas: ${msg}\n\n${debugLines.join("\n")}`
        );
      } finally {
        setLoadingTables(false);
      }
    })();
  }, [initialTable, autopickFirstTable]);

  // ====== traduÃ§Ã£o do filtro -> supabase ======
  const applyConditionToQuery = (q: any, c: Condition) => {
    const col = c.column;
    const v = c.value ?? "";
    switch (c.op) {
      // texto
      case "contains":
        return q.ilike(col, `%${v}%`);
      case "not_contains":
        return q.not(col, "ilike", `%${v}%`);
      case "starts_with":
        return q.ilike(col, `${v}%`);
      case "ends_with":
        return q.ilike(col, `%${v}`);
      case "equals":
        return q.eq(col, v);
      case "neq":
        return q.neq(col, v);
      case "in":
        return q.in(col, splitList(v));
      case "null":
        return q.is(col, null);
      case "not_null":
        return q.not(col, "is", null);

      // numÃ©rico
      case "gt":
        return q.gt(col, castNum(v));
      case "gte":
        return q.gte(col, castNum(v));
      case "lt":
        return q.lt(col, castNum(v));
      case "lte":
        return q.lte(col, castNum(v));
      case "between":
        return q.gte(col, castNum(v)).lte(col, castNum(c.value2 ?? v));

      // data
      case "on":
        return q.gte(col, startOfDay(v)).lt(col, endOfDay(v));
      case "before":
        return q.lt(col, startOfDay(v));
      case "after":
        return q.gte(col, endOfDay(v));

      // boolean
      case "is_true":
        return q.eq(col, true);
      case "is_false":
        return q.eq(col, false);

      default:
        return q;
    }
  };

  function splitList(v: string) {
    return v
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  function castNum(v: string) {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  function startOfDay(iso: string) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  function endOfDay(iso: string) {
    const d = new Date(iso);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }

  // Carrega dados
  const loadData = useCallback(async () => {
    const t = table?.trim();
    if (!t) return;
    try {
      setLoading(true);
      setError(null);
      setRows([]);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Monta query com ordenaÃ§Ã£o padrÃ£o por ID quando nÃ£o houver sort explÃ­cito
      const buildBase = () => supabase.from(t).select("*", { count: "exact" }).range(from, to);
      let query = buildBase();

      if (sortConfig) {
        query = query.order(sortConfig.column, {
          ascending: sortConfig.direction === "asc",
        });
      } else {
        // Best-effort: tenta ordenar por "id" asc; se a coluna nÃ£o existir, fazemos fallback sem order
        try {
          query = query.order("id", { ascending: true } as any);
        } catch {}
      }

      if (simpleApplied && simpleApplied.column && simpleApplied.op) {
        query = applyConditionToQuery(query, simpleApplied);
      }

      let { data, error, count } = await query;
      // Se falhar por causa do order id (tabela sem coluna id), refaz sem order
      if (error && !sortConfig) {
        let q2 = buildBase();
        if (simpleApplied && simpleApplied.column && simpleApplied.op) {
          q2 = applyConditionToQuery(q2, simpleApplied);
        }
        const res2 = await q2;
        data = res2.data as any;
        error = res2.error as any;
        count = res2.count as any;
      }
      if (error) throw error;

      setRows((data as Row[]) ?? []);
      setCount(count ?? 0);
      setSelectedRows(new Set());
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.message ||
        e?.error_description ||
        e?.hint ||
        e?.details ||
        JSON.stringify(e);
      setError(`Falha ao carregar dados: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [table, page, pageSize, sortConfig, simpleApplied]);

  // Reset ao trocar de tabela
  useEffect(() => {
    updateURL({ page: 1 });
    setSimpleDraft({ id: "simple", column: "", op: "contains", value: "", value2: "" });
    setSimpleApplied(null);
    setSortConfig(null);
    setSelectedRows(new Set());
  }, [table]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!table) {
      setAllRowsState(null);
      setAllRowsLoading(false);
      setAllRowsError(null);
      return;
    }
    if (!hasSearch) {
      setAllRowsState(null);
      setAllRowsLoading(false);
      setAllRowsError(null);
      return;
    }
    if (allRowsState?.table === table) return;
    let cancelled = false;
    const fetchAllRows = async () => {
      try {
        setAllRowsLoading(true);
        setAllRowsError(null);
        const { data, error } = await supabase.from(table).select("*", { count: "exact" });
        if (error) throw error;
        if (cancelled) return;
        setAllRowsState({ table, rows: (data as Row[]) ?? [] });
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setAllRowsError(err?.message || err?.details || String(err));
          setAllRowsState({ table, rows: [] });
        }
      } finally {
        if (!cancelled) setAllRowsLoading(false);
      }
    };
    fetchAllRows();
    return () => {
      cancelled = true;
    };
  }, [table, hasSearch, trimmedSearch, allRowsState]);

  // helpers UI
  const getRowId = (r?: Row | null) => {
    if (!r) return "";
    return resolveIdSmart(r, settings.idField) || String((r as any)?.id ?? (r as any)?.ID ?? "");
  };

  // ====== URL ABSOLUTA (para QR/etiqueta) â€” COM ?ik= ======
  const getEditUrl = (r?: Row | null) => {
    const id = getRowId(r || undefined);
    if (!table || !id || !r) return "";
    const idKey = resolveIdKeyFromRow(r);
    const anchor = makeAnchorId(id);

    // Ensure mobile devices get Supabase config if not baked via env (dev convenience)
    const SB_URL =
      (import.meta as any)?.env?.VITE_SUPABASE_URL ||
      localStorage.getItem("sb_url") ||
      "";
    const SB_KEY =
      (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
      localStorage.getItem("sb_key") ||
      "";

    // Preserve current list state (page, pageSize, q, etc.) when present
    const qs = new URLSearchParams(urlSearch ? urlSearch.slice(1) : "");
    qs.set("ik", idKey);
    const needSB = !(
      (import.meta as any)?.env?.VITE_SUPABASE_URL &&
      (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY
    );
    if (needSB && SB_URL && SB_KEY) {
      qs.set("sb_url", SB_URL);
      qs.set("sb_key", SB_KEY);
    }
    const qstr = qs.toString() ? `?${qs.toString()}` : "";

    return `${BASE_URL}/table/${encodeURIComponent(table)}/edit/${encodeURIComponent(
      String(id)
    )}${qstr}#${anchor}`;
  };

  // ====== PATH RELATIVO (link Editar) â€” incl. ?ik= para consistÃªncia ======
  const getEditPath = (r?: Row | null) => {
    const id = getRowId(r || undefined);
    if (!table || !id || !r) return "";
    const anchor = makeAnchorId(id);
    const idKey = resolveIdKeyFromRow(r);

    const qs = new URLSearchParams(urlSearch ? urlSearch.slice(1) : "");
    qs.set("ik", idKey);
    const qstr = qs.toString() ? `?${qs.toString()}` : "";

    return `/table/${encodeURIComponent(table)}/edit/${encodeURIComponent(
      String(id)
    )}${qstr}#${anchor}`;
  };

  // ======= CONCERTO =======
  const [repairDlg, setRepairDlg] = useState<{
    open: boolean;
    row: Row | null;
    motivo: string;
    fornecedor: string;
    nota: string;
    dataSaida: string; // YYYY-MM-DD
    saving: boolean;
    err: string | null;
  }>({
    open: false,
    row: null,
    motivo: "",
    fornecedor: "",
    nota: "",
    dataSaida: todayLocalISO(),
    saving: false,
    err: null,
  });

  const getItemLabel = (r: Row) =>
    resolveField(r, "", [
      "nome",
      "name",
      "descricao",
      "descriÃ§Ã£o",
      "titulo",
      "tÃ­tulo",
      "modelo",
      "produto",
    ]) ||
    resolveFieldFuzzy(r, ["nome", "name", "descric", "titul", "modelo", "produto"]) ||
    getRowId(r);

  const openRepairModal = (r: Row) => {
    setRepairDlg({
      open: true,
      row: r,
      motivo: "",
      fornecedor: "",
      nota: "",
      dataSaida: todayLocalISO(),
      saving: false,
      err: null,
    });
  };

  const sendToRepair = async (r: Row) => openRepairModal(r);

  const confirmCreateRepair = async () => {
    const t = table?.trim();
    const r = repairDlg.row;
    if (!t || !r) return;

    try {
      setRepairDlg((s) => ({ ...s, saving: true, err: null }));

      const idVal = getRowId(r);
      if (!idVal) throw new Error("NÃ£o foi possÃ­vel identificar o ID do item.");

      // JÃ¡ existe concerto aberto?
      const { data: existing, error: exErr } = await supabase
        .from("concerto")
        .select("id")
        .eq("table_name", t)
        .eq("item_id", String(idVal))
        .is("data_retorno", null)
        .maybeSingle();

      if (exErr && exErr.code !== "PGRST116") throw exErr;
      if (existing?.id) {
        setRepairDlg((s) => ({ ...s, open: false, saving: false }));
        window.location.href = `/concerto?focus=${encodeURIComponent(String(existing.id))}`;
        return;
      }

      // chaves do item
      const idKey = resolveIdKeyFromRow(r);
      const statusKey = resolveStatusKeyFromRow(r);

      const payload: any = {
        table_name: t,
        item_id: String(idVal),
        item_label: String(getItemLabel(r) || idVal),
        id_key: idKey,
        status_key: statusKey,
        item_snapshot: r,
        status: "aberto",
        enviado_em: new Date().toISOString(), // timestamptz
        data_saida: repairDlg.dataSaida || todayLocalISO(), // date
        motivo: repairDlg.motivo?.trim() || null,
        fornecedor: repairDlg.fornecedor?.trim() || null,
        nota: repairDlg.nota?.trim() || null,
      };

      const { data: created, error: insErr } = await supabase
        .from("concerto")
        .insert(payload)
        .select()
        .single();

      if (insErr) throw insErr;

      // Best-effort: marcar item como EM_CONCERTO
      try {
        const match = /^\d+$/.test(String(idVal)) ? Number(idVal) : idVal;
        await supabase.from(t).update({ [statusKey]: "EM_CONCERTO" }).eq(idKey, match);
      } catch {}

      setRepairDlg((s) => ({ ...s, open: false, saving: false }));
      loadData();
      window.location.href = `/concerto?focus=${encodeURIComponent(String(created?.id))}`;
    } catch (e: any) {
      const msg = e?.message || e?.details || String(e);
      setRepairDlg((s) => ({ ...s, saving: false, err: msg }));
    }
  };

  const openDesigner = (r: Row) => {
    setDesignerRow(r);
    setDesignerOpen(true);
  };

  const printNow = (r?: Row | null) => {
    if (!r) return;
    const url = getEditUrl(r);
    if (!url) return;
    setQrForPrint({ url, row: r });
  };

  // Export
  const exportData = (format: "csv" | "json") => {
    try {
      const data = visibleRows ?? [];
      if (!data.length) return;

      if (format === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = `${table || "export"}.json`;
        a.click();
        URL.revokeObjectURL(u);
        return;
      }

      // CSV export
      const cols = columns.filter((c) => c !== ACTIONS_COL_KEY);
      const escapeCsv = (v: any) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return JSON.stringify(v);
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };

      const header = cols.map((c) => String(c).replace(/"/g, '""')).join(",");
      const rowsCsv = data
        .map((r) => cols.map((c) => escapeCsv((r as any)[c])).join(","))
        .join("\n");
      const csv = [header, rowsCsv].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const urlBlob = URL.createObjectURL(blob);
      const a2 = document.createElement("a");
      a2.href = urlBlob;
      a2.download = `${table || "export"}.csv`;
      a2.click();
      URL.revokeObjectURL(urlBlob);
    } catch (e: any) {
      console.error(e);
      setError(`Falha ao exportar: ${e?.message ?? String(e)}`);
    }
  };

  // Criar novo item na tabela atual e abrir em ediÃ§Ã£o
  const createNewItem = async () => {
    const t = table?.trim();
    if (!t) return;
    try {
      setLoading(true);
      setError(null);
      // Primeira tentativa: insert vazio
      let attempt = await supabase.from(t).insert({}).select().single();
      if (attempt.error) {
        const msg = attempt.error.message || "";
        const details = (attempt.error as any)?.details || "";
        const combined = `${msg} ${details}`;
        const m = combined.match(/null value in column "([^"]+)"/i);
        const notNullCol = m?.[1] || "";

        // Se falhou por coluna NOT NULL (ex.: id), tenta montar payload mÃ­nimo
        if (notNullCol) {
          const payload: Record<string, any> = {};
          // Acha provÃ¡vel coluna de id nas colunas atuais
          const idCandidates = ["id", "ID", "Id", "iD"]; 
          let idKey = idCandidates.find((c) => columns.includes(c));
          if (!idKey) idKey = columns.find((c) => c.toLowerCase() === "id" || c.toLowerCase().startsWith("id_"));
          if (!idKey && notNullCol.toLowerCase().includes("id")) idKey = notNullCol;

          if (idKey) {
            const sample = rows.find((r) => r && r[idKey!] != null);
            const sampleVal = sample ? sample[idKey] : null;
            const isNumeric = sampleVal != null && /^\d+$/.test(String(sampleVal));
            payload[idKey] = isNumeric
              ? (Math.max(0, ...rows.map((r) => Number(r?.[idKey!]) || 0)) + 1)
              : uuidv4();
          } else {
            payload[notNullCol] = uuidv4();
          }

          attempt = await supabase.from(t).insert(payload).select().single();
          if (attempt.error) throw attempt.error;
        } else {
          throw attempt.error;
        }
      }

      const row = attempt.data as Row;
      const to = getEditPath(row);
      if (to) window.location.href = to; else loadData();
    } catch (e: any) {
      const msg = e?.message || e?.details || String(e);
      setError(`Falha ao criar item: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      setError(null);
      if (table) {
        const { error } = await supabase.from(table).select("*").limit(1);
        if (error) setError(`DiagnÃ³stico falhou: ${error.message}`);
        else alert("DiagnÃ³stico OK: conexÃ£o com a tabela bem sucedida.");
      } else {
        const { error } = await supabase.rpc("list_tables" as any);
        if (error) setError(`DiagnÃ³stico falhou: ${error.message}`);
        else alert("DiagnÃ³stico OK: RPC list_tables executado.");
      }
    } catch (e: any) {
      console.error(e);
      setError(`DiagnÃ³stico falhou: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Colunas (limitadas aos campos principais do formulÃ¡rio de ediÃ§Ã£o)
  const columns = useMemo(() => {
    if (!rows.length) return [] as string[];
    const all = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => all.add(k)));

    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const has = (k: string) => all.has(k);
    const findBy = (cands: string[]): string | null => {
      // procura por equivalÃªncia direta e por chave normalizada
      const keys = Array.from(all);
      const byNorm = new Map<string, string>();
      keys.forEach((k) => byNorm.set(norm(k), k));
      for (const c of cands) {
        if (has(c)) return c;
        const k = byNorm.get(norm(c));
        if (k) return k;
      }
      return null;
    };

    const SPEC: string[][] = [
      ['ativo'],
      ['comentario','comentÃ¡rio','observacao','observaÃ§Ã£o','observacoes','observaÃ§Ãµes','coment','comentarios'],
      ['entidade','empresa','org','organizacao','organizaÃ§Ã£o'],
      ['fabricante','marca'],
      ['localizacao','localizaÃ§Ã£o','local','setor','sala'],
      ['modelo'],
      ['nome','name','descricao','descriÃ§Ã£o','titulo','tÃ­tulo','produto'],
      ['numero_serie','num_serie','n_serie','serial','serie'],
      ['rede','network','ssid'],
      ['status','situacao','situaÃ§Ã£o','state'],
      ['tipo','categoria','category'],
      ['updated_at','updatedat','ultima_atualizacao','ultima atualizaÃ§Ã£o','last_update','updated']
    ];

    const selected: string[] = [];
    for (const cands of SPEC) {
      const k = findBy(cands);
      if (k && !selected.includes(k)) selected.push(k);
    }

    // adiciona coluna de aÃ§Ãµes no final
    selected.push(ACTIONS_COL_KEY);
    return selected;
  }, [rows]);

  // Metadados (tipo por amostragem)
  const columnMeta: ColumnMeta[] = useMemo(() => {
    const sample = rows.slice(0, 30);
    const names = new Set<string>();
    sample.forEach((r) => Object.keys(r).forEach((k) => names.add(k)));
    return Array.from(names)
      .map((name) => {
        const v = sample.map((r) => (r as any)[name]).find((x) => x != null);
        return { name, type: typeGuess(v) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Auto-guess campos p/ etiquetas
  useEffect(() => {
    if (!columns.length) return;
    setSettings((s) => {
      const patch: Partial<LabelSettings> = {};
      const guessField = (cols: string[], candidates: string[]) => {
        const lc = cols.map((c) => c.toLowerCase());
        for (const c of candidates) {
          const i = lc.indexOf(c.toLowerCase());
          if (i >= 0) return cols[i];
        }
        return "";
      };
      if (!s.nameField)
        patch.nameField = guessField(columns, [
          "nome",
          "name",
          "descricao",
          "descriÃ§Ã£o",
          "titulo",
          "tÃ­tulo",
          "modelo",
          "produto",
        ]);
      if (!s.idField) patch.idField = guessField(columns, ["id", "ID", "Id"]);
      if (!s.inventoryField)
        patch.inventoryField = guessField(columns, [
          "idinventario",
          "id_inventario",
          "inventario",
          "inventÃ¡rio",
          "patrimonio",
          "patrimÃ´nio",
          "tombo",
          "serial",
          "num_serie",
          "n_serie",
        ]);
      return { ...s, ...patch };
    });
  }, [columns]);

  // Busca global client-side
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const flattenRow = (obj: any): string => {
    try {
      const parts: string[] = [];
      const visit = (v: any) => {
        if (v == null) return;
        if (["string", "number", "boolean"].includes(typeof v)) parts.push(String(v));
        else if (Array.isArray(v)) v.forEach(visit);
        else if (typeof v === "object") Object.values(v).forEach(visit);
      };
      visit(obj);
      return normalize(parts.join(" "));
    } catch {
      return normalize(String(obj));
    }
  };

  const filteredRows = useMemo(() => {
    if (!hasSearch) return rows;
    const base = allRowsState?.rows ?? rows;
    const q = normalize(trimmedSearch);
    if (!q) return base;
    return base.filter((r) => flattenRow(r).includes(q));
  }, [rows, allRowsState, trimmedSearch, hasSearch]);

  const effectiveCount = hasSearch ? filteredRows.length : count;
  const totalPages = hasSearch ? 1 : Math.max(1, Math.ceil(effectiveCount / pageSize));
  const showingRows = hasSearch ? filteredRows : rows;
  const pageStart = (page - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const visibleRows = hasSearch ? showingRows : showingRows.slice(pageStart, pageEnd);

  // Ajusta automaticamente o pageSize conforme a altura visÃ­vel do container
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (viewMode !== 'table') return; // sÃ³ faz sentido na tabela
    if (autoPageRef.current.manual) return; // usuÃ¡rio escolheu manualmente

    const measureAndSet = () => {
      try {
        const container = document.querySelector<HTMLDivElement>('div.flex-1.overflow-y-auto');
        // Mede a altura real da linha: tenta o layout minimalista primeiro
        const sampleRow = (document.querySelector<HTMLElement>('[data-tb-row]') as HTMLElement | null) ||
                          (document.querySelector<HTMLTableRowElement>('table tbody tr') as unknown as HTMLElement | null);
        const ch = container?.clientHeight || 0;
        const rh = sampleRow?.getBoundingClientRect().height || 52; // fallback aproximado
        if (ch > 120 && rh > 16) {
          const fit = Math.max(10, Math.min(500, Math.floor(ch / rh) - 1));
          if (fit > 0 && fit !== pageSize) {
            // MantÃ©m o usuÃ¡rio no topo da lista ao recalcular
            updateURL({ pageSize: fit, page: 1 });
          }
        }
      } catch {}
    };

    const schedule = () => {
      if (autoPageRef.current.timer) window.clearTimeout(autoPageRef.current.timer as number);
      autoPageRef.current.timer = window.setTimeout(measureAndSet, 80);
    };

    // roda inicialmente e quando dados mudam
    schedule();
    window.addEventListener('resize', schedule);

    // observa mudanÃ§as no container (p/ quando header muda de altura)
    let ro: ResizeObserver | null = null;
    const cont = document.querySelector('div.flex-1.overflow-y-auto') as HTMLElement | null;
    if (typeof ResizeObserver !== 'undefined' && cont) {
      ro = new ResizeObserver(() => schedule());
      ro.observe(cont);
    }
    return () => {
      window.removeEventListener('resize', schedule);
      if (autoPageRef.current.timer) window.clearTimeout(autoPageRef.current.timer as number);
      if (ro && cont) ro.unobserve(cont);
      if (ro) ro.disconnect();
    };
  }, [rows.length, columns.join('|'), viewMode]);

  const availableColumns = useMemo(
    () => columns.filter((c) => c !== ACTIONS_COL_KEY),
    [columns]
  );

  // SeleÃ§Ã£o
  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows);
    newSelected.has(index) ? newSelected.delete(index) : newSelected.add(index);
    setSelectedRows(newSelected);
  };
  const toggleAllRows = () => {
    if (selectedRows.size === visibleRows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(visibleRows.map((_, idx) => idx)));
  };

  // OrdenaÃ§Ã£o
  const handleSort = (column: string) => {
    if (column === ACTIONS_COL_KEY) return;
    if (sortConfig?.column === column) {
      const next = {
        column,
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      } as SortConfig;
      setSortConfig(next);
      updateURL({ sort: JSON.stringify(next) });
    } else {
      const next = { column, direction: "asc" } as SortConfig;
      setSortConfig(next);
      updateURL({ sort: JSON.stringify(next) });
    }
    updateURL({ page: 1 });
  };

  // Aplicar/Limpar filtro simples
  const applySimple = () => {
    setSimpleApplied(simpleDraft);
    updateURL({ filters: JSON.stringify({ ...simpleDraft, id: undefined }), page: 1 });
  };
  const clearSimple = () => {
    const cleared = {
      id: "simple",
      column: "",
      op: "contains",
      value: "",
      value2: "",
    } as Condition;
    setSimpleDraft(cleared);
    setSimpleApplied(null);
    updateURL({ filters: "", page: 1 });
  };

  const metaFor = (col: string) =>
    columnMeta.find((m) => m.name === col)?.type ?? "text";

  const opsForType = (t: ScalarType): { value: AnyOp; label: string }[] => {
    switch (t) {
      case "text":
        return [
          { value: "contains", label: "ContÃ©m" },
          { value: "not_contains", label: "NÃ£o contÃ©m" },
          { value: "equals", label: "Igual" },
          { value: "neq", label: "Diferente" },
          { value: "starts_with", label: "ComeÃ§a com" },
          { value: "ends_with", label: "Termina com" },
          { value: "in", label: "Em lista" },
          { value: "null", label: "Ã‰ nulo" },
          { value: "not_null", label: "NÃ£o Ã© nulo" },
        ];
      case "number":
        return [
          { value: "equals", label: "=" },
          { value: "neq", label: "â‰ " },
          { value: "gt", label: ">" },
          { value: "gte", label: "â‰¥" },
          { value: "lt", label: "<" },
          { value: "lte", label: "â‰¤" },
          { value: "between", label: "Entre" },
          { value: "in", label: "Em lista" },
          { value: "null", label: "Ã‰ nulo" },
          { value: "not_null", label: "NÃ£o Ã© nulo" },
        ];
      case "date":
        return [
          { value: "on", label: "No dia" },
          { value: "before", label: "Antes de" },
          { value: "after", label: "Depois de" },
          { value: "between", label: "Entre" },
          { value: "null", label: "Ã‰ nulo" },
          { value: "not_null", label: "NÃ£o Ã© nulo" },
        ];
      case "boolean":
        return [
          { value: "is_true", label: "Ã‰ verdadeiro" },
          { value: "is_false", label: "Ã‰ falso" },
          { value: "null", label: "Ã‰ nulo" },
          { value: "not_null", label: "NÃ£o Ã© nulo" },
        ];
      default:
        return [{ value: "contains", label: "ContÃ©m" }] as any;
    }
  };

  /* ============================== RENDER ============================== */
  const appliedCount = simpleApplied?.column ? 1 : 0;
  const rawCountForDisplay = hasSearch
    ? allRowsState?.rows.length ?? count ?? rows.length
    : rows.length;
  const combinedLoading = loading || (hasSearch && allRowsLoading);
  const combinedError = error || (hasSearch ? allRowsError : null);
  const effectivePage = hasSearch ? 1 : page;
  const gotoFirst = () => {
    if (hasSearch) return;
    updateURL({ page: 1 });
  };
  const gotoPrev = () => {
    if (hasSearch) return;
    updateURL({ page: Math.max(1, page - 1) });
  };
  const gotoNext = () => {
    if (hasSearch) return;
    updateURL({ page: Math.min(totalPages, page + 1) });
  };
  const gotoLast = () => {
    if (hasSearch) return;
    updateURL({ page: totalPages });
  };

  return (
    <>
      <TableBrowserLayout
        // topo
        tables={tables}
        table={table}
        onChangeTable={setTable}
        effectiveCount={effectiveCount}
        globalSearch={globalSearch}
        onChangeSearch={(q: string) => {
          setGlobalSearch(q);
          updateURL({ q, page: 1 });
        }}
        onApplyServerFilter={applySimple}
        onRunDiagnostics={runDiagnostics}
        // filtro
        columnMeta={columnMeta}
        draft={{
          column: simpleDraft.column,
          op: simpleDraft.op,
          value: simpleDraft.value,
          value2: simpleDraft.value2,
        }}
        setDraft={(patch: Partial<Condition>) =>
          setSimpleDraft((s) => ({ ...s, ...patch }))
        }
        getTypeFor={metaFor}
        getOpsFor={opsForType}
        onClearFilter={clearSimple}
        appliedCount={appliedCount}
        // seleÃ§Ã£o/erro
        selectedCount={selectedRows.size}
        onClearSelection={() => setSelectedRows(new Set())}
        error={combinedError}
        // tabela
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        availableColumns={availableColumns}
        columns={columns}
        ACTIONS_COL_KEY={ACTIONS_COL_KEY}
        visibleRows={visibleRows}
        selectedRows={selectedRows}
        onToggleAll={toggleAllRows}
        onToggleRow={toggleRowSelection}
        onSort={handleSort}
        getEditPath={getEditPath}
        onDesigner={openDesigner}
        onPrint={printNow}
        onSendToRepair={sendToRepair}
        getRowId={getRowId}
        stringifyCell={stringifyCell}
        formatCell={cleanFormatCell}
        // export
        canExport={visibleRows.length > 0}
        onExportCSV={() => exportData("csv")}
        onExportJSON={() => exportData("json")}
        // criar
        canCreate={!!table}
        onCreate={createNewItem}
        // paginaÃ§Ã£o
        page={effectivePage}
        pageSize={pageSize}
        totalPages={totalPages}
        onChangePageSize={(n: number) => {
          if (hasSearch) return;
          autoPageRef.current.manual = true;
          updateURL({ pageSize: n, page: 1 });
        }}
        gotoFirst={gotoFirst}
        gotoPrev={gotoPrev}
        gotoNext={gotoNext}
        gotoLast={gotoLast}
        // footer
        rawCount={rawCountForDisplay}
        loading={combinedLoading}
      />

      {/* Canvas oculto para gerar QR antes de imprimir */}
      {(qrForPrint || (designerOpen && designerRow)) && (
        <div className="hidden">
          <QRCodeCanvas
            id="print-qr"
            value={
              (qrForPrint?.url ?? (designerRow ? getEditUrl(designerRow) : "")) || ""
            }
            size={Math.max(50, pxIfMm(settings.qrSize, settings.unit))}
            includeMargin
          />
        </div>
      )}

      {/* Drawer / Modal do Designer */}
      {designerOpen && designerRow && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDesignerOpen(false)}
            aria-hidden
          />
          <div className="relative ml-auto h-full w-full sm:w-[720px] bg-white shadow-xl p-4 sm:p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Designer de etiqueta</h3>
              <button
                onClick={() => setDesignerOpen(false)}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
                aria-label="Fechar designer"
              >
                Ã—
              </button>
            </div>

            <div className="space-y-6">
              <section>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Pre-visualizacao</h4>
                <div className="p-3 border rounded bg-slate-50 inline-block">
                  <LabelPreview row={designerRow as Row} settings={settings} getEditUrl={getEditUrl} />
                </div>
                <p className="mt-2 text-xs text-slate-500">A escala eh aproximada. Ajuste as medidas abaixo conforme a etiqueta real.</p>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Layout</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-600">Unidade</span>
                    <select
                      value={settings.unit}
                      onChange={(e) => setSettings((s) => ({ ...s, unit: e.target.value as Unit }))}
                      className="rounded border px-3 py-2"
                    >
                      <option value="mm">Milimetros</option>
                      <option value="px">Pixels</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-600">Posicao do QR</span>
                    <select
                      value={settings.qrPlacement}
                      onChange={(e) => setSettings((s) => ({ ...s, qrPlacement: e.target.value as LabelSettings['qrPlacement'] }))}
                      className="rounded border px-3 py-2"
                    >
                      <option value="left">A esquerda</option>
                      <option value="right">A direita</option>
                      <option value="top">Acima do texto</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-600">Largura ({settings.unit})</span>
                    <input
                      type="number"
                      min={20}
                      step={1}
                      value={settings.width}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) setSettings((s) => ({ ...s, width: value }));
                      }}
                      className="rounded border px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-600">Altura ({settings.unit})</span>
                    <input
                      type="number"
                      min={20}
                      step={1}
                      value={settings.height}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) setSettings((s) => ({ ...s, height: value }));
                      }}
                      className="rounded border px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-600">Margem ({settings.unit})</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={settings.margin}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) setSettings((s) => ({ ...s, margin: value }));
                      }}
                      className="rounded border px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-600">Tamanho do QR ({settings.unit})</span>
                    <input
                      type="number"
                      min={10}
                      step={1}
                      value={settings.qrSize}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) setSettings((s) => ({ ...s, qrSize: value }));
                      }}
                      className="rounded border px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-600">Tamanho da fonte ({settings.unit})</span>
                    <input
                      type="number"
                      min={1}
                      step={0.1}
                      value={settings.fontSize}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) setSettings((s) => ({ ...s, fontSize: value }));
                      }}
                      className="rounded border px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-600">EspaÃ§amento entre linhas</span>
                    <input
                      type="number"
                      min={0.8}
                      step={0.05}
                      value={settings.lineHeight}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) setSettings((s) => ({ ...s, lineHeight: value }));
                      }}
                      className="rounded border px-3 py-2"
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">ConteÃºdo</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.showName}
                        onChange={(e) => setSettings((s) => ({ ...s, showName: e.target.checked }))}
                      />
                      Mostrar nome
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.showId}
                        onChange={(e) => setSettings((s) => ({ ...s, showId: e.target.checked }))}
                      />
                      Mostrar ID
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.showInventory}
                        onChange={(e) => setSettings((s) => ({ ...s, showInventory: e.target.checked }))}
                      />
                      Mostrar patrimÃ´nio/inventÃ¡rio
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.showUrl}
                        onChange={(e) => setSettings((s) => ({ ...s, showUrl: e.target.checked }))}
                      />
                      Mostrar link completo
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-600">Coluna para nome</span>
                      <select
                        value={settings.nameField}
                        onChange={(e) => setSettings((s) => ({ ...s, nameField: e.target.value }))}
                        className="rounded border px-3 py-2"
                      >
                        <option value="">AutomÃ¡tico</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-600">Coluna para ID</span>
                      <select
                        value={settings.idField}
                        onChange={(e) => setSettings((s) => ({ ...s, idField: e.target.value }))}
                        className="rounded border px-3 py-2"
                      >
                        <option value="">AutomÃ¡tico</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-600">Coluna para patrimÃ´nio/inventÃ¡rio</span>
                      <select
                        value={settings.inventoryField}
                        onChange={(e) => setSettings((s) => ({ ...s, inventoryField: e.target.value }))}
                        className="rounded border px-3 py-2"
                      >
                        <option value="">AutomÃ¡tico</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Extras</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-slate-600">Linha extra 1</span>
                    <select
                      value={settings.extra1Mode}
                      onChange={(e) => setSettings((s) => ({ ...s, extra1Mode: e.target.value as ExtraMode }))}
                      className="rounded border px-3 py-2"
                    >
                      <option value="text">Texto fixo</option>
                      <option value="column">Coluna</option>
                    </select>
                    {settings.extra1Mode === 'text' ? (
                      <input
                        type="text"
                        value={settings.extra1Text}
                        onChange={(e) => setSettings((s) => ({ ...s, extra1Text: e.target.value }))}
                        className="rounded border px-3 py-2"
                        placeholder="Ex.: Sala 101"
                      />
                    ) : (
                      <select
                        value={settings.extra1Column}
                        onChange={(e) => setSettings((s) => ({ ...s, extra1Column: e.target.value }))}
                        className="rounded border px-3 py-2"
                      >
                        <option value="">Selecionar coluna</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-slate-600">Linha extra 2</span>
                    <select
                      value={settings.extra2Mode}
                      onChange={(e) => setSettings((s) => ({ ...s, extra2Mode: e.target.value as ExtraMode }))}
                      className="rounded border px-3 py-2"
                    >
                      <option value="text">Texto fixo</option>
                      <option value="column">Coluna</option>
                    </select>
                    {settings.extra2Mode === 'text' ? (
                      <input
                        type="text"
                        value={settings.extra2Text}
                        onChange={(e) => setSettings((s) => ({ ...s, extra2Text: e.target.value }))}
                        className="rounded border px-3 py-2"
                        placeholder="Ex.: PatrimÃ´nio pÃºblico"
                      />
                    ) : (
                      <select
                        value={settings.extra2Column}
                        onChange={(e) => setSettings((s) => ({ ...s, extra2Column: e.target.value }))}
                        className="rounded border px-3 py-2"
                      >
                        <option value="">Selecionar coluna</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </section>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSettings(DEFAULT_SETTINGS)}
                  className="px-3 py-2 rounded border text-sm text-slate-600 hover:bg-slate-50"
                >
                  Restaurar padrÃ£o
                </button>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDesignerOpen(false)}
                    className="px-4 py-2 rounded border text-sm hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => printNow(designerRow)}
                    className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >
                    Imprimir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Abrir concerto */}
      {repairDlg.open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setRepairDlg((s) => ({ ...s, open: false }))}
          />
          <div className="relative mx-auto my-10 w-[min(560px,95vw)] bg-white rounded-xl shadow-xl border p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">Abrir concerto</h4>
              <button
                onClick={() => setRepairDlg((s) => ({ ...s, open: false }))}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none" aria-label="Fechar designer"
              >
                âœ•
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Motivo</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ex.: diagnÃ³stico, nÃ£o liga, tela quebradaâ€¦"
                  value={repairDlg.motivo}
                  onChange={(e) => setRepairDlg((s) => ({ ...s, motivo: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Fornecedor</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ex.: Empresa XYZ"
                  value={repairDlg.fornecedor}
                  onChange={(e) => setRepairDlg((s) => ({ ...s, fornecedor: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Nota</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="NÃºmero da nota (minuta)"
                  value={repairDlg.nota}
                  onChange={(e) => setRepairDlg((s) => ({ ...s, nota: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Data de saÃ­da (previsÃ£o)</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={repairDlg.dataSaida}
                    onChange={(e) => setRepairDlg((s) => ({ ...s, dataSaida: e.target.value }))}
                  />
                </div>
              </div>

              {repairDlg.err && (
                <div className="p-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm">
                  {repairDlg.err}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRepairDlg((s) => ({ ...s, open: false }))}
                  className="px-4 py-2 rounded border"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmCreateRepair}
                  disabled={repairDlg.saving}
                  className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {repairDlg.saving ? "Salvandoâ€¦" : "Salvar e abrir concerto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------- Auxiliares de UI/Etiqueta ---------------------- */

function LabelPreview({
  row,
  settings,
  getEditUrl,
}: {
  row: Row;
  settings: LabelSettings;
  getEditUrl: (r: Row) => string;
}) {
  if (!row) return null as any;
  const url = getEditUrl(row);
  const unit = settings.unit;
  const qrPx = pxIfMm(settings.qrSize, unit);
  const fontPx = pxIfMm(settings.fontSize, unit);
  const lines = makeLines(row, url, settings);
  const placement = settings.qrPlacement ?? "left";
  const isTop = placement === "top";
  const isRight = placement === "right";
  const containerClass = [
    "border rounded bg-white shadow-sm",
    isTop ? "flex flex-col items-center gap-2" : "flex items-center gap-2",
  ].join(' ');
  const qrElement = <QRCodeCanvas value={url} size={qrPx} includeMargin />;
  const textClass = [
    'overflow-hidden',
    isTop ? 'text-center w-full' : 'flex-1',
  ].join(' ');
  const textElement = (
    <div style={{ fontSize: fontPx, lineHeight: String(settings.lineHeight) }} className={textClass}>
      {lines.map((html, i) => (
        <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
      ))}
    </div>
  );

  return (
    <div
      className={containerClass}
      style={{ width: boxSizeCss(settings.width, unit), height: boxSizeCss(settings.height, unit) }}
      title="Preview (escala aproximada)"
    >
      {isTop ? (
        <>
          {qrElement}
          {textElement}
        </>
      ) : (
        <>
          {!isRight && qrElement}
          {textElement}
          {isRight && qrElement}
        </>
      )}
    </div>
  );
}

function makeLines(row: Row, url: string, s: LabelSettings): string[] {
  const lines: string[] = [];
  if (s.showName) {
    const nameVal = resolveField(row, s.nameField, [
      "nome",
      "name",
      "descricao",
      "descriÃ§Ã£o",
      "titulo",
      "tÃ­tulo",
      "modelo",
      "produto",
    ]);
    const v = String(nameVal ?? "").trim();
    if (v) lines.push(`<strong>${escapeHtml(v)}</strong>`);
  }
  if (s.showId) {
    let idVal = getField(row, s.idField);
    if (!idVal || String(idVal).trim() === "")
      idVal = (row as any)?.id ?? (row as any)?.ID ?? (row as any)?.Id ?? (row as any)?.iD ?? "";
    const v = String(idVal ?? "").trim();
    if (v) lines.push(`ID: ${escapeHtml(v)}`);
  }
  if (s.showInventory) {
    const invVal = resolveField(row, s.inventoryField, [
      "idinventario",
      "id_inventario",
      "inventario",
      "inventÃ¡rio",
      "patrimonio",
      "patrimÃ´nio",
      "tombo",
      "serial",
      "num_serie",
      "n_serie",
    ]);
    const v = String(invVal ?? "").trim();
    if (v) lines.push(`Inv.: ${escapeHtml(v)}`);
  }
  if (s.extra1Mode === "text" && s.extra1Text.trim()) lines.push(escapeHtml(s.extra1Text));
  if (s.extra1Mode === "column") {
    const v = String(getField(row, s.extra1Column) ?? "").trim();
    if (v) lines.push(escapeHtml(v));
  }
  if (s.extra2Mode === "text" && s.extra2Text.trim()) lines.push(escapeHtml(s.extra2Text));
  if (s.extra2Mode === "column") {
    const v = String(getField(row, s.extra2Column) ?? "").trim();
    if (v) lines.push(escapeHtml(v));
  }
  if (s.showUrl) lines.push(`<span class="small">${escapeHtml(url)}</span>`);
  return lines;
}

function boxSizeCss(v: number, unit: Unit) {
  return v + (unit as string);
}
function pxIfMm(v: number, unit: Unit) {
  return unit === "px" ? Math.max(16, Math.round(v)) : Math.max(16, Math.round(v * 3.78));
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));
}
  function stringifyCell(v: any): string {
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  }
  const cleanFormatCell = (v: any): string => {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "sim" : "nao";
    if (typeof v === "object") {
      const str = JSON.stringify(v);
      return str.length > 50 ? `${str.substring(0, 47)}...` : str;
    }
    const str = String(v);
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
      try {
        const d = new Date(str);
        return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      } catch {
        return str;
      }
    }
    if (!isNaN(Number(str)) && str.length > 0 && /^\d+\.?\d*$/.test(str)) {
      const num = Number(str);
      if (Number.isInteger(num) && num > 999) return num.toLocaleString("pt-BR");
    }
    return str.length > 50 ? `${str.substring(0, 47)}...` : str;
  };
function formatCell(v: any): string {
  if (v == null) return "â€”";
  if (typeof v === "boolean") return v ? "âœ“" : "âœ—";
  if (typeof v === "object") {
    const str = JSON.stringify(v);
    return str.length > 50 ? `${str.substring(0, 47)}...` : str;
  }
  const str = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    try {
      const d = new Date(str);
      return (
        d.toLocaleDateString("pt-BR") +
        " " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return str;
    }
  }
  if (!isNaN(Number(str)) && str.length > 0 && /^\d+\.?\d*$/.test(str)) {
    const num = Number(str);
    if (Number.isInteger(num) && num > 999) return num.toLocaleString("pt-BR");
  }
  return str.length > 50 ? `${str.substring(0, 47)}...` : str;
}

export { ACTIONS_COL_KEY };











