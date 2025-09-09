// src/components/TableBrowser.tsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../services/supabase";

/** ===== Tipos ===== */
type Row = Record<string, any>;
type TableMeta = { schemaname: string; tablename: string };

const BASE_URL =
  (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || window.location.origin;

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
  value?: string; // valor 1
  value2?: string; // valor 2 (entre)
}

interface FilterGroup {
  id: string;
  mode: "ALL" | "ANY"; // ALL=AND, ANY=OR dentro do grupo
  conditions: Condition[];
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
  showName: boolean;
  showId: boolean;
  showInventory: boolean;
  showUrl: boolean;
  // mapeamento
  nameField: string;
  idField: string;
  inventoryField: string;
  // extras (texto livre ou valor de coluna)
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

/* ======================= helpers gerais ======================= */
const uid = () => Math.random().toString(36).slice(2, 9);

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

const guessField = (cols: string[], candidates: string[]) => {
  const lc = cols.map((c) => c.toLowerCase());
  for (const c of candidates) {
    const i = lc.indexOf(c.toLowerCase());
    if (i >= 0) return cols[i];
  }
  return "";
};

/** Retorna a 1ª coluna do row que tenha um valor não-vazio. */
function pickFirstField(row: Row, candidates: string[]): string {
  for (const c of candidates) {
    const v = getField(row, c);
    if (v !== "") return String(v);
  }
  return "";
}

/** Busca fuzzy: acha 1ª coluna cujo nome contenha algum dos termos. */
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
    "código",
    "cod",
    "asset_id",
    "assetId",
    "idinventario",
    "id_inventario",
    "tombo",
    "patrimonio",
    "patrimônio",
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

function resolveStatusSmart(row: Row): string {
  return (
    pickFirstField(row, [
      "status",
      "situacao",
      "situação",
      "state",
      "ativo",
      "atividade",
    ]) || resolveFieldFuzzy(row, ["status", "situacao", "situação", "state", "ativo"])
  );
}

function resolveNetworkSmart(row: Row): string {
  return (
    pickFirstField(row, [
      "rede",
      "network",
      "ssid",
      "setor",
      "setor_nome",
      "local",
      "localizacao",
      "localização",
      "ip",
      "endereco_ip",
      "endereço_ip",
      "host",
      "hostname",
    ]) ||
    resolveFieldFuzzy(row, ["rede", "network", "ssid", "setor", "local", "ip", "host"])
  );
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
  // Estados principais
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [table, setTable] = useState<string>(initialTable);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca global client-side
  const [globalSearch, setGlobalSearch] = useState(initialSearch);

  // Ordenação
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Paginação
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // UI
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [compactView, setCompactView] = useState(false);

  // Export
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  // Designer / Impressão
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

  // ======== NOVO: Query Builder (grupos/condições) ========
  const [draftGroups, setDraftGroups] = useState<FilterGroup[]>([
    { id: uid(), mode: "ALL", conditions: [] },
  ]);
  const [appliedGroups, setAppliedGroups] = useState<FilterGroup[]>([]);

  // Impressão via Browser Print
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

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Etiqueta</title>
  <style>
    @media print {
      @page { size: ${pageW} ${pageH}; margin: ${margin}; }
      body { margin: 0; }
    }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial; }
    .label { display:flex; align-items:center; gap:${unit === "mm" ? "2mm" : "8px"}; padding:${
        unit === "mm" ? "1mm" : "4px"
      }; }
    .qr { width:${qrSide}; height:${qrSide}; }
    .t { font-size:${fontSize}; line-height:${settings.lineHeight}; }
    .t strong { font-size: calc(${fontSize} * 1.05); }
    .small { font-size: calc(${fontSize} * 0.85); color:#333; word-break:break-all; display:block; }
  </style>
</head>
<body onload="window.print(); setTimeout(()=>window.close(), 600);">
  <div class="label">
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrForPrint, settings.unit, settings.width, settings.height, settings.margin, settings.qrSize, settings.fontSize, settings.lineHeight, settings.showName, settings.showId, settings.showInventory, settings.showUrl]);

  // Fechar dropdown/Designer ao clicar fora / ESC
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExportOpen(false);
        setDesignerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Carrega nomes das tabelas (public)
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

        const publicTables = (data ?? []).filter(
          (t) => t.schemaname?.toLowerCase() === "public"
        );
        const dedup = Array.from(
          new Map(publicTables.map((t) => [t.tablename, t])).values()
        ).sort((a, b) => a.tablename.localeCompare(b.tablename));

        setTables(dedup);

        if (!initialTable && autopickFirstTable && dedup[0]) {
          const clean = dedup[0].tablename.replace(/^public\./i, "");
          setTable(clean);
        }
      } catch (e: any) {
        console.error(e);
        const msg =
          e?.message ||
          e?.error_description ||
          e?.hint ||
          e?.details ||
          JSON.stringify(e);
        setError(`Falha ao listar tabelas: ${msg}`);
      } finally {
        setLoadingTables(false);
      }
    })();
  }, [initialTable, autopickFirstTable]);

  // ====== tradução do builder -> supabase ======
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

      // numérico
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

  const conditionToOrExpr = (c: Condition) => {
    const col = c.column;
    const esc = (s: string) => s.replace(/,/g, "\\,"); // escapar vírgulas no PostgREST

    switch (c.op) {
      case "contains":
        return `${col}.ilike.*${esc(c.value || "")}*`;
      case "not_contains":
        return `${col}.not.ilike.*${esc(c.value || "")}*`;
      case "starts_with":
        return `${col}.ilike.${esc(c.value || "")}*`;
      case "ends_with":
        return `${col}.ilike.*${esc(c.value || "")}`;
      case "equals":
        return `${col}.eq.${esc(c.value || "")}`;
      case "neq":
        return `${col}.neq.${esc(c.value || "")}`;
      case "in":
        return `${col}.in.(${splitList(c.value || "")
          .map(esc)
          .join(",")})`;
      case "null":
        return `${col}.is.null`;
      case "not_null":
        return `${col}.not.is.null`;
      case "gt":
        return `${col}.gt.${esc(c.value || "")}`;
      case "gte":
        return `${col}.gte.${esc(c.value || "")}`;
      case "lt":
        return `${col}.lt.${esc(c.value || "")}`;
      case "lte":
        return `${col}.lte.${esc(c.value || "")}`;
      case "between": {
        const a = c.value || "";
        const b = c.value2 || a;
        return `and(${col}.gte.${esc(a)},${col}.lte.${esc(b)})`;
      }
      case "on":
        return `and(${col}.gte.${startOfDay(c.value || "")},${col}.lt.${endOfDay(
          c.value || ""
        )})`;
      case "before":
        return `${col}.lt.${startOfDay(c.value || "")}`;
      case "after":
        return `${col}.gte.${endOfDay(c.value || "")}`;
      case "is_true":
        return `${col}.eq.true`;
      case "is_false":
        return `${col}.eq.false`;
      default:
        return "";
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

  // Carrega dados (usa grupos aplicados)
  const loadData = useCallback(async () => {
    const t = table.trim();
    if (!t) return;
    try {
      setLoading(true);
      setError(null);
      setRows([]);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase.from(t).select("*", { count: "exact" }).range(from, to);

      if (sortConfig) {
        query = query.order(sortConfig.column, {
          ascending: sortConfig.direction === "asc",
        });
      }

      // AND entre grupos; dentro de grupo: ALL aplica 1 a 1; ANY vira .or(...)
      for (const g of appliedGroups) {
        const conds = g.conditions.filter((c) => c.column && c.op);
        if (conds.length === 0) continue;

        if (g.mode === "ALL") {
          conds.forEach((c) => {
            query = applyConditionToQuery(query, c);
          });
        } else {
          const parts = conds.map(conditionToOrExpr).filter(Boolean);
          if (parts.length > 0) query = query.or(parts.join(","));
        }
      }

      const { data, error, count } = await query;
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
  }, [table, page, pageSize, sortConfig, appliedGroups]);

  // Reset ao trocar de tabela
  useEffect(() => {
    setPage(1);
    setDraftGroups([{ id: uid(), mode: "ALL", conditions: [] }]);
    setAppliedGroups([]);
    setSortConfig(null);
    setSelectedRows(new Set());
  }, [table]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Funções auxiliares usadas na UI
  const getRowId = (r?: Row | null) => {
    if (!r) return "";
    return (
      resolveIdSmart(r, settings.idField) ||
      String((r as any)?.id ?? (r as any)?.ID ?? "")
    );
  };

  const getEditUrl = (r?: Row | null) => {
    const id = getRowId(r || undefined);
    if (!table || !id) return "";
    return `${BASE_URL}/table/${encodeURIComponent(
      table
    )}/edit/${encodeURIComponent(String(id))}`;
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
        setExportOpen(false);
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
      setExportOpen(false);
    } catch (e: any) {
      console.error(e);
      setError(`Falha ao exportar: ${e?.message ?? String(e)}`);
    }
  };

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      setError(null);
      if (table) {
        const { error } = await supabase.from(table).select("*").limit(1);
        if (error) {
          setError(`Diagnóstico falhou: ${error.message}`);
        } else {
          alert("Diagnóstico OK: conexão com a tabela bem sucedida.");
        }
      } else {
        const { error } = await supabase.rpc("list_tables" as any);
        if (error) setError(`Diagnóstico falhou: ${error.message}`);
        else alert("Diagnóstico OK: RPC list_tables executado.");
      }
    } catch (e: any) {
      console.error(e);
      setError(`Diagnóstico falhou: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Colunas
  const columns = useMemo(() => {
    if (!rows.length) return [] as string[];
    const keys = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    let cols = Array.from(keys);

    const ativoIdx = cols.findIndex((c) => c.toLowerCase() === "ativo");
    if (ativoIdx >= 0) {
      if (!cols.includes(ACTIONS_COL_KEY)) cols.splice(ativoIdx + 1, 0, ACTIONS_COL_KEY);
    } else {
      if (!cols.includes(ACTIONS_COL_KEY)) cols.push(ACTIONS_COL_KEY);
    }
    return cols;
  }, [rows]);

  // Metadados (tipo por amostragem)
  const columnMeta: ColumnMeta[] = useMemo(() => {
    const sample = rows.slice(0, 30);
    const names = new Set<string>();
    sample.forEach((r) => Object.keys(r).forEach((k) => names.add(k)));
    return Array.from(names)
      .map((name) => {
        const v = sample.map((r) => (r as any)[name]).find((x) => x !== null && x !== undefined);
        return { name, type: typeGuess(v) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Auto-guess de campos quando cols mudarem
  useEffect(() => {
    if (!columns.length) return;
    setSettings((s) => {
      const patch: Partial<LabelSettings> = {};
      if (!s.nameField)
        patch.nameField = guessField(columns, [
          "nome",
          "name",
          "descricao",
          "descrição",
          "titulo",
          "título",
          "modelo",
          "produto",
        ]);
      if (!s.idField) patch.idField = guessField(columns, ["id", "ID", "Id"]);
      if (!s.inventoryField)
        patch.inventoryField = guessField(columns, [
          "idinventario",
          "id_inventario",
          "inventario",
          "inventário",
          "patrimonio",
          "patrimônio",
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
    const q = normalize(globalSearch.trim());
    if (!q) return rows;
    return rows.filter((r) => flattenRow(r).includes(q));
  }, [rows, globalSearch]);

  const effectiveCount = globalSearch ? filteredRows.length : count;
  const totalPages = Math.max(1, Math.ceil(effectiveCount / pageSize));
  const showingRows = globalSearch ? filteredRows : rows;
  const pageStart = (page - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const visibleRows = globalSearch ? showingRows.slice(pageStart, pageEnd) : showingRows;

  // Seleção
  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows);
    newSelected.has(index) ? newSelected.delete(index) : newSelected.add(index);
    setSelectedRows(newSelected);
  };
  const toggleAllRows = () => {
    if (selectedRows.size === visibleRows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(visibleRows.map((_, idx) => idx)));
  };

  // Ordenação
  const handleSort = (column: string) => {
    if (column === ACTIONS_COL_KEY) return;
    if (sortConfig?.column === column) {
      setSortConfig({
        column,
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSortConfig({ column, direction: "asc" });
    }
    setPage(1);
  };

  // ===== Query Builder — ações =====
  const addGroup = () =>
    setDraftGroups((gs) => [...gs, { id: uid(), mode: "ALL", conditions: [] }]);
  const removeGroup = (gid: string) =>
    setDraftGroups((gs) => gs.filter((g) => g.id !== gid));
  const setGroupMode = (gid: string, mode: "ALL" | "ANY") =>
    setDraftGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, mode } : g)));
  const addCondition = (gid: string) =>
    setDraftGroups((gs) =>
      gs.map((g) =>
        g.id === gid
          ? { ...g, conditions: [...g.conditions, { id: uid(), column: "", op: "contains", value: "" }] }
          : g
      )
    );
  const removeCondition = (gid: string, cid: string) =>
    setDraftGroups((gs) =>
      gs.map((g) =>
        g.id === gid ? { ...g, conditions: g.conditions.filter((c) => c.id !== cid) } : g
      )
    );
  const patchCondition = (gid: string, cid: string, patch: Partial<Condition>) =>
    setDraftGroups((gs) =>
      gs.map((g) =>
        g.id === gid
          ? {
              ...g,
              conditions: g.conditions.map((c) => (c.id === cid ? { ...c, ...patch } : c)),
            }
          : g
      )
    );
  const applyFilters = () => {
    setAppliedGroups(draftGroups);
    setPage(1);
  };

  const metaFor = (col: string) =>
    columnMeta.find((m) => m.name === col)?.type ?? "text";

  const opsForType = (t: ScalarType): { value: AnyOp; label: string }[] => {
    switch (t) {
      case "text":
        return [
          { value: "contains", label: "Contém" },
          { value: "not_contains", label: "Não contém" },
          { value: "equals", label: "Igual" },
          { value: "neq", label: "Diferente" },
          { value: "starts_with", label: "Começa com" },
          { value: "ends_with", label: "Termina com" },
          { value: "in", label: "Em lista" },
          { value: "null", label: "É nulo" },
          { value: "not_null", label: "Não é nulo" },
        ];
      case "number":
        return [
          { value: "equals", label: "=" },
          { value: "neq", label: "≠" },
          { value: "gt", label: ">" },
          { value: "gte", label: "≥" },
          { value: "lt", label: "<" },
          { value: "lte", label: "≤" },
          { value: "between", label: "Entre" },
          { value: "in", label: "Em lista" },
          { value: "null", label: "É nulo" },
          { value: "not_null", label: "Não é nulo" },
        ];
      case "date":
        return [
          { value: "on", label: "No dia" },
          { value: "before", label: "Antes de" },
          { value: "after", label: "Depois de" },
          { value: "between", label: "Entre" },
          { value: "null", label: "É nulo" },
          { value: "not_null", label: "Não é nulo" },
        ];
      case "boolean":
        return [
          { value: "is_true", label: "É verdadeiro" },
          { value: "is_false", label: "É falso" },
          { value: "null", label: "É nulo" },
          { value: "not_null", label: "Não é nulo" },
        ];
      default:
        return [{ value: "contains", label: "Contém" }] as any;
    }
  };

  /* ============================== RENDER ============================== */
  return (
    <section className="container-max my-6">
      {/* barra topo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="tb-table">
            Tabela:
          </label>
          <select
            id="tb-table"
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm min-w-[220px]"
          >
            <option value="">— Selecionar —</option>
            {tables.map((t) => {
              const cleanName = t.tablename.replace(/^public\./i, "");
              return (
                <option key={t.tablename} value={cleanName}>
                  {cleanName}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar na página (client-side)"
            className="px-4 py-2 rounded-lg border border-gray-300 shadow-sm w-[340px]"
          />
          <button
            onClick={applyFilters}
            disabled={loading || !table || loadingTables}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            title="Buscar no servidor (respeita filtros do builder e ordenação)"
          >
            {loading ? "Carregando…" : "Aplicar filtros"}
          </button>
          <button
            onClick={runDiagnostics}
            className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            title="Testar conectividade"
          >
            🧪
          </button>
        </div>
      </div>

      {/* Query Builder */}
      <div className="mb-4 rounded-xl border bg-white">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-medium">Filtros avançados</div>
          <div className="text-xs text-gray-600">
            {appliedGroups.reduce((n, g) => n + g.conditions.length, 0)} condição(ões) aplicadas
          </div>
        </div>

        <div className="p-3 space-y-3">
          {draftGroups.map((g) => (
            <div key={g.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Este grupo deve satisfazer</span>
                  <select
                    value={g.mode}
                    onChange={(e) => setGroupMode(g.id, e.target.value as "ALL" | "ANY")}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="ALL">TODAS as condições (AND)</option>
                    <option value="ANY">QUALQUER condição (OR)</option>
                  </select>
                </div>
                <button
                  className="text-rose-600 text-sm"
                  onClick={() => removeGroup(g.id)}
                >
                  Remover grupo
                </button>
              </div>

              <div className="space-y-2">
                {g.conditions.map((c) => {
                  const t = metaFor(c.column);
                  const ops = opsForType(t);
                  const op = c.op && ops.find((o) => o.value === c.op) ? c.op : ops[0].value;
                  const showValue2 = op === "between";
                  const isDate = t === "date";
                  const inputType = isDate ? "date" : t === "number" ? "number" : "text";
                  return (
                    <div key={c.id} className="flex flex-wrap items-center gap-2">
                      <select
                        value={c.column}
                        onChange={(e) =>
                          patchCondition(g.id, c.id, { column: e.target.value })
                        }
                        className="px-2 py-1 border rounded text-sm min-w-[160px]"
                      >
                        <option value="">— coluna —</option>
                        {columnMeta
                          .filter((m) => m.name !== ACTIONS_COL_KEY)
                          .map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                      </select>

                      <select
                        value={op}
                        onChange={(e) =>
                          patchCondition(g.id, c.id, { op: e.target.value as AnyOp })
                        }
                        className="px-2 py-1 border rounded text-sm"
                      >
                        {ops.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>

                      {op === "in" ? (
                        <input
                          placeholder="valor1, valor2, valor3"
                          value={c.value || ""}
                          onChange={(e) =>
                            patchCondition(g.id, c.id, { value: e.target.value })
                          }
                          className="px-2 py-1 border rounded text-sm flex-1 min-w-[220px]"
                        />
                      ) : op === "null" ||
                        op === "not_null" ||
                        op === "is_true" ||
                        op === "is_false" ? null : (
                        <>
                          <input
                            type={inputType}
                            value={c.value || ""}
                            onChange={(e) =>
                              patchCondition(g.id, c.id, { value: e.target.value })
                            }
                            className="px-2 py-1 border rounded text-sm min-w-[160px]"
                          />
                          {showValue2 && (
                            <input
                              type={inputType}
                              value={c.value2 || ""}
                              onChange={(e) =>
                                patchCondition(g.id, c.id, { value2: e.target.value })
                              }
                              className="px-2 py-1 border rounded text-sm min-w-[160px]"
                            />
                          )}
                        </>
                      )}

                      <button
                        className="text-rose-600 text-sm"
                        onClick={() => removeCondition(g.id, c.id)}
                      >
                        remover
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2">
                <button
                  className="px-2 py-1 border rounded text-sm"
                  onClick={() => addCondition(g.id)}
                >
                  + condição
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border rounded" onClick={addGroup}>
              + grupo
            </button>
            <button
              className="px-3 py-1.5 text-blue-600"
              onClick={() => setDraftGroups([{ id: uid(), mode: "ALL", conditions: [] }])}
            >
              Limpar rascunho
            </button>

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={applyFilters}
                disabled={loading || !table}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white shadow-sm border border-blue-700/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Aplicar filtros atuais e pesquisar no servidor"
              >
                {/* ícone de lupa */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  fill="none"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-5.2-5.2M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {loading ? "Carregando…" : "Aplicar filtro e pesquisar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela + header */}
      <div className="bg-white rounded-xl shadow border">
        <div className="p-4 border-b">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Explorador de Tabelas</h2>
                {effectiveCount > 0 && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {effectiveCount.toLocaleString()} registros
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompactView((v) => !v)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  title={compactView ? "Vista normal" : "Vista compacta"}
                >
                  {compactView ? "Normal" : "Compacta"}
                </button>
                <button
                  onClick={applyFilters}
                  disabled={loading || !table}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Carregando…" : "Atualizar"}
                </button>

                <div ref={exportRef} className="relative">
                  {(() => {
                    const hasData = visibleRows.length > 0;
                    return (
                      <button
                        onClick={() => hasData && setExportOpen((v) => !v)}
                        disabled={!hasData}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white shadow-sm border border-emerald-700/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-haspopup="menu"
                        aria-expanded={exportOpen}
                        title={hasData ? "Exportar dados visíveis" : "Nada para exportar"}
                      >
                        Exportar
                      </button>
                    );
                  })()}

                  {exportOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-40 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20"
                    >
                      <button
                        onClick={() => exportData("csv")}
                        className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        role="menuitem"
                      >
                        <span>📄</span> Exportar CSV
                      </button>
                      <button
                        onClick={() => exportData("json")}
                        className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        role="menuitem"
                      >
                        <span>🗂️</span> Exportar JSON
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* aviso de erro */}
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Seleção */}
            {selectedRows.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">
                    {selectedRows.size} linha{selectedRows.size !== 1 ? "s" : ""} selecionada
                    {selectedRows.size !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => setSelectedRows(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Limpar seleção
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela Desktop */}
      <div className="hidden md:block">
        <div className="max-h-[70vh] overflow-auto border rounded-md bg-white">
          <table className="min-w-full text-[13px] border border-gray-200">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="w-8 px-3 py-2 border-b border-gray-200">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === visibleRows.length && visibleRows.length > 0}
                    onChange={toggleAllRows}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className={`text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 ${
                      col === ACTIONS_COL_KEY ? "" : "cursor-pointer hover:bg-gray-100"
                    } ${compactView ? "py-1" : ""}`}
                    onClick={() => col !== ACTIONS_COL_KEY && handleSort(col)}
                    title={col !== ACTIONS_COL_KEY ? "Ordenar" : undefined}
                  >
                    <div className="flex items-center gap-1">
                      <span className="uppercase tracking-wider text-[11px]">
                        {col === ACTIONS_COL_KEY ? "AÇÕES" : col}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => {
                const href = getEditUrl(row);
                const disabled = !href;
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="w-8 px-3 py-2 border-t border-gray-200">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(idx)}
                        onChange={() => toggleRowSelection(idx)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>

                    {columns.map((col) => {
                      if (col === ACTIONS_COL_KEY) {
                        return (
                          <td key={col} className="px-3 py-2 border-t border-gray-200 align-middle">
                            <div className="flex items-center gap-2">
                              {href ? (
                                <a
                                  href={href}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700"
                                  title="Abrir edição do item"
                                >
                                  Editar
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}

                              <button
                                onClick={() => openDesigner(row)}
                                disabled={disabled}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs transition-colors ${
                                  disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                                }`}
                                title="Personalizar etiqueta (abrir designer)"
                              >
                                🎛️ Designer
                              </button>

                              <button
                                onClick={() => printNow(row)}
                                disabled={disabled}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs transition-colors ${
                                  disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                                }`}
                                title="Imprimir com a configuração atual (Browser Print)"
                              >
                                🖨️ Imprimir
                              </button>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col}
                          className={`px-3 py-2 border-t border-gray-200 align-top ${
                            compactView ? "py-1 text-[12px]" : ""
                          }`}
                          title={stringifyCell((row as any)[col])}
                        >
                          <div className="max-w-[280px] truncate">
                            {formatCell((row as any)[col])}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {!loading && visibleRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards Mobile */}
      <div className="md:hidden">
        <div className="space-y-4 p-3">
          {visibleRows.map((row, idx) => {
            const href = getEditUrl(row);
            const disabled = !href;
            return (
              <MobileItemCard
                key={idx}
                row={row}
                index={idx}
                href={href}
                disabled={disabled}
                selected={selectedRows.has(idx)}
                onToggleSelected={() => toggleRowSelection(idx)}
                onDesigner={() => openDesigner(row)}
                onPrint={() => printNow(row)}
                settings={settings}
              />
            );
          })}
          {!loading && visibleRows.length === 0 && (
            <div className="p-8 text-center text-gray-500">Nenhum registro encontrado</div>
          )}
        </div>
      </div>

      {/* Paginação */}
      <div className="border-t bg-gray-50 px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-700">
            <span>Mostrando </span>
            <span className="font-medium">
              {Math.min((page - 1) * pageSize + 1, effectiveCount)}
            </span>
            <span> a </span>
            <span className="font-medium">
              {Math.min(page * pageSize, effectiveCount)}
            </span>
            <span> de </span>
            <span className="font-medium">{effectiveCount}</span>
            <span> registros</span>
            {globalSearch && (
              <span className="text-blue-600"> (filtrados de {rows.length})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 text-sm border border-gray-300 rounded"
            >
              <option value={10}>10/página</option>
              <option value={20}>20/página</option>
              <option value={50}>50/página</option>
              <option value={100}>100/página</option>
              <option value={200}>200/página</option>
            </select>

            <div className="flex gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1 || loading}
                className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                ««
              </button>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || loading}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                ‹
              </button>
              <span className="px-3 py-1 text-sm bg-blue-50 border border-blue-200 rounded">
                {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || loading}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || loading}
                className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                »»
              </button>
            </div>
          </div>
        </div>
      </div>

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
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDesignerOpen(false)}
          />
          <div className="relative ml-auto h-full w-full sm:w-[640px] bg-white shadow-xl p-4 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Designer de Etiqueta</h3>
              <button
                onClick={() => setDesignerOpen(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            {/* Controles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Unidade</label>
                <div className="flex gap-2">
                  <button
                    className={`px-3 py-1 border rounded ${
                      settings.unit === "mm" ? "bg-blue-50 border-blue-300" : "bg-white"
                    }`}
                    onClick={() => setSettings((s) => ({ ...s, unit: "mm" }))}
                  >
                    mm
                  </button>
                  <button
                    className={`px-3 py-1 border rounded ${
                      settings.unit === "px" ? "bg-blue-50 border-blue-300" : "bg-white"
                    }`}
                    onClick={() => setSettings((s) => ({ ...s, unit: "px" }))}
                  >
                    px
                  </button>
                </div>
              </div>

              <NumberField
                label="Largura"
                value={settings.width}
                unit={settings.unit}
                onChange={(v) => setSettings((s) => ({ ...s, width: v }))}
              />
              <NumberField
                label="Altura"
                value={settings.height}
                unit={settings.unit}
                onChange={(v) => setSettings((s) => ({ ...s, height: v }))}
              />
              <NumberField
                label="Margem"
                value={settings.margin}
                unit={settings.unit}
                onChange={(v) => setSettings((s) => ({ ...s, margin: v }))}
              />
              <NumberField
                label="Tamanho do QR"
                value={settings.qrSize}
                unit={settings.unit}
                onChange={(v) => setSettings((s) => ({ ...s, qrSize: v }))}
              />
              <NumberField
                label="Fonte base"
                value={settings.fontSize}
                unit={settings.unit}
                onChange={(v) => setSettings((s) => ({ ...s, fontSize: v }))}
              />
              <NumberField
                label="Altura da linha"
                value={settings.lineHeight}
                unit=""
                step={0.05}
                onChange={(v) => setSettings((s) => ({ ...s, lineHeight: v }))}
              />

              {/* Campos de informação (mapeamento) */}
              <div className="col-span-2 grid grid-cols-2 gap-3">
                {/* Nome */}
                <div className="col-span-2 flex items-center gap-2">
                  <Check
                    label="Mostrar nome"
                    checked={settings.showName}
                    onChange={(v) => setSettings((s) => ({ ...s, showName: v }))}
                  />
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">
                      Campo do nome
                    </label>
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={settings.nameField}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, nameField: e.target.value }))
                      }
                    >
                      <option value="">— auto (aliases) —</option>
                      {columns
                        .filter((c) => c !== ACTIONS_COL_KEY)
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                    <FieldHint
                      row={designerRow}
                      field={settings.nameField}
                      fallbackAliases={[
                        "nome",
                        "name",
                        "descricao",
                        "descrição",
                        "titulo",
                        "título",
                        "modelo",
                        "produto",
                      ]}
                    />
                  </div>
                </div>

                {/* ID */}
                <div className="col-span-2 flex items-center gap-2">
                  <Check
                    label="Mostrar ID"
                    checked={settings.showId}
                    onChange={(v) => setSettings((s) => ({ ...s, showId: v }))}
                  />
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">
                      Campo do ID
                    </label>
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={settings.idField}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, idField: e.target.value }))
                      }
                    >
                      <option value="">— auto (id) —</option>
                      {columns
                        .filter((c) => c !== ACTIONS_COL_KEY)
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                    <FieldHint
                      row={designerRow}
                      field={settings.idField}
                      fallbackId={getRowId(designerRow)}
                    />
                  </div>
                </div>

                {/* Inventário */}
                <div className="col-span-2 flex items-center gap-2">
                  <Check
                    label="Mostrar Inventário"
                    checked={settings.showInventory}
                    onChange={(v) => setSettings((s) => ({ ...s, showInventory: v }))}
                  />
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">
                      Campo do Inventário
                    </label>
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={settings.inventoryField}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, inventoryField: e.target.value }))
                      }
                    >
                      <option value="">— auto (aliases) —</option>
                      {columns
                        .filter((c) => c !== ACTIONS_COL_KEY)
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                    <FieldHint
                      row={designerRow}
                      field={settings.inventoryField}
                      fallbackAliases={[
                        "idinventario",
                        "id_inventario",
                        "inventario",
                        "inventário",
                        "patrimonio",
                        "patrimônio",
                        "tombo",
                        "serial",
                        "num_serie",
                        "n_serie",
                      ]}
                    />
                  </div>
                </div>

                {/* URL */}
                <div className="col-span-2">
                  <Check
                    label="Mostrar URL"
                    checked={settings.showUrl}
                    onChange={(v) => setSettings((s) => ({ ...s, showUrl: v }))}
                  />
                </div>
              </div>

              {/* Extras */}
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Extra 1</label>
                  <div className="flex gap-2">
                    <select
                      value={settings.extra1Mode}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          extra1Mode: e.target.value as ExtraMode,
                        }))
                      }
                      className="border rounded px-2 py-1"
                    >
                      <option value="text">Texto</option>
                      <option value="column">Coluna</option>
                    </select>
                    {settings.extra1Mode === "text" ? (
                      <input
                        className="flex-1 border rounded px-2 py-1"
                        value={settings.extra1Text}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, extra1Text: e.target.value }))
                        }
                      />
                    ) : (
                      <select
                        className="flex-1 border rounded px-2 py-1"
                        value={settings.extra1Column}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, extra1Column: e.target.value }))
                        }
                      >
                        <option value="">— selecionar —</option>
                        {columns
                          .filter((c) => c !== ACTIONS_COL_KEY)
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Extra 2</label>
                  <div className="flex gap-2">
                    <select
                      value={settings.extra2Mode}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          extra2Mode: e.target.value as ExtraMode,
                        }))
                      }
                      className="border rounded px-2 py-1"
                    >
                      <option value="text">Texto</option>
                      <option value="column">Coluna</option>
                    </select>
                    {settings.extra2Mode === "text" ? (
                      <input
                        className="flex-1 border rounded px-2 py-1"
                        value={settings.extra2Text}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, extra2Text: e.target.value }))
                        }
                      />
                    ) : (
                      <select
                        className="flex-1 border rounded px-2 py-1"
                        value={settings.extra2Column}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, extra2Column: e.target.value }))
                        }
                      >
                        <option value="">— selecionar —</option>
                        {columns
                          .filter((c) => c !== ACTIONS_COL_KEY)
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Preview</h4>
              <LabelPreview row={designerRow as Row} settings={settings} getEditUrl={getEditUrl} />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDesignerOpen(false)} className="px-3 py-2 rounded border">
                Fechar
              </button>
              <button
                onClick={() => printNow(designerRow)}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------------- Componentes auxiliares ---------------------- */
function NumberField({
  label,
  value,
  onChange,
  unit,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">
        {label} {unit && <span className="text-gray-400">({unit})</span>}
      </label>
      <input
        type="number"
        step={step ?? 1}
        className="w-full border rounded px-2 py-1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="rounded border-gray-300"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function FieldHint({
  row,
  field,
  fallbackId,
  fallbackAliases = [],
}: {
  row: Row | null;
  field: string;
  fallbackId?: any;
  fallbackAliases?: string[];
}) {
  if (!row) return <div className="text-[11px] text-gray-500 mt-1">&nbsp;</div>;
  const chosen = getField(row, field);
  let value: any = chosen;
  let origin: "chosen" | "alias" | "id" | "none" = "none";

  if (chosen !== "") {
    origin = "chosen";
  } else if (fallbackId != null && (field === "" || chosen === "")) {
    value = fallbackId;
    origin = "id";
  } else if (fallbackAliases.length) {
    value = resolveField(row, "", fallbackAliases);
    if (value !== "") origin = "alias";
  }

  return (
    <div className="text-[11px] text-gray-500 mt-1">
      {origin === "none" ? (
        <>
          → valor: <span className="opacity-70">—</span>
        </>
      ) : (
        <>
          → valor: <span className="font-medium">{String(value)}</span>{" "}
          {origin !== "chosen" && <span className="opacity-70">({origin})</span>}
        </>
      )}
    </div>
  );
}

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

  return (
    <div
      className="border rounded p-2 inline-flex items-center gap-2 bg-white"
      style={{ width: boxSizeCss(settings.width, unit), height: boxSizeCss(settings.height, unit) }}
      title="Preview (escala aproximada)"
    >
      <QRCodeCanvas value={url} size={qrPx} includeMargin />
      <div style={{ fontSize: fontPx, lineHeight: String(settings.lineHeight) }} className="overflow-hidden">
        {lines.map((html, i) => (
          <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
        ))}
      </div>
    </div>
  );
}

/* ===== Card mobile com ID, Nome, Status e Rede (robusto) ===== */
function MobileItemCard({
  row,
  index,
  href,
  disabled,
  selected,
  onToggleSelected,
  onDesigner,
  onPrint,
  settings,
}: {
  row: Row;
  index: number;
  href: string | "";
  disabled: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onDesigner: () => void;
  onPrint: () => void;
  settings: LabelSettings;
}) {
  const nameVal =
    resolveField(row, settings.nameField, [
      "nome",
      "name",
      "descricao",
      "descrição",
      "titulo",
      "título",
      "modelo",
      "produto",
    ]) || resolveFieldFuzzy(row, ["nome", "name", "descric", "titul", "modelo", "produto"]);
  const idVal = resolveIdSmart(row, settings.idField);
  const statusVal = resolveStatusSmart(row);
  const redeVal = resolveNetworkSmart(row);
  const url = href;

  return (
    <div
      className={`rounded-2xl border-2 border-black bg-white shadow-md ${
        selected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white" : ""
      }`}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="text-xs text-gray-600 font-medium">Registro #{index + 1}</div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={selected}
            onChange={onToggleSelected}
          />
          <span className="text-gray-700">Selecionar</span>
        </label>
      </div>

      <div className="px-4 py-3">
        <div className="text-base font-semibold text-gray-900 leading-snug">
          {nameVal ? String(nameVal) : "— sem nome —"}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2">
          <div className="rounded-xl border border-gray-300 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">ID</div>
            <div className="text-[15px] font-medium text-gray-900">{idVal || "—"}</div>
          </div>

          <div className="rounded-xl border border-gray-300 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Status</div>
            <div className="text-[15px] font-medium text-gray-900">{statusVal || "—"}</div>
          </div>

          <div className="rounded-xl border border-gray-300 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Rede</div>
            <div className="text-[15px] font-medium text-gray-900">{redeVal || "—"}</div>
          </div>

          {settings.showUrl && url && (
            <div className="rounded-xl border border-gray-300 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">URL</div>
              <a href={url} className="text-[14px] text-blue-700 break-all underline">
                {url}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 pt-2 border-t border-gray-200 flex items-center gap-2">
        {href ? (
          <a
            href={href}
            className="inline-flex items-center justify-center flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-medium active:scale-[0.99]"
            title="Abrir edição do item"
          >
            Editar
          </a>
        ) : (
          <button
            disabled
            className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-400 text-sm font-medium cursor-not-allowed"
          >
            Editar
          </button>
        )}

        <button
          onClick={onDesigner}
          disabled={disabled}
          className={`h-10 px-3 rounded-xl border text-sm font-medium ${
            disabled ? "opacity-50 cursor-not-allowed" : "bg-white hover:bg-gray-50"
          }`}
          title="Personalizar etiqueta"
        >
          🎛️ Designer
        </button>

        <button
          onClick={onPrint}
          disabled={disabled}
          className={`h-10 px-3 rounded-xl border text-sm font-medium ${
            disabled ? "opacity-50 cursor-not-allowed" : "bg-white hover:bg-gray-50"
          }`}
          title="Imprimir"
        >
          🖨️
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Utilitários --------------------------- */
function makeLines(row: Row, url: string, s: LabelSettings): string[] {
  const lines: string[] = [];

  if (s.showName) {
    const nameVal = resolveField(row, s.nameField, [
      "nome",
      "name",
      "descricao",
      "descrição",
      "titulo",
      "título",
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
      "inventário",
      "patrimonio",
      "patrimônio",
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
  if (unit === "px") return Math.max(16, Math.round(v));
  return Math.max(16, Math.round(v * 3.78)); // ~1mm ≈ 3.78px @96dpi
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));
}

function stringifyCell(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
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
