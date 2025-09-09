// src/pages/SetoresMapa.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

/** ===== CONFIG IMAGEM / LAYOUT ===== */
const MAP_IMAGE_SRC = "/planta.png";
const STORAGE_KEY = "setores_mapa_v1"; // override local do usuário
const CFG_KEY = "setores_cfg_v1"; // fonte de dados
const DEFAULT_URL =
  (import.meta as any)?.env?.VITE_SETORES_LAYOUT_URL || "/setores-layout.json";

/** ===== FALLBACK PADRÃO EMBUTIDO ===== */
type Sector = {
  id: string;
  name: string;
  x: number; // % left
  y: number; // % top
  w: number; // % width
  h: number; // % height
  color?: string;
};

const DEFAULT_LAYOUT_FALLBACK: Sector[] = [
  {"id":"evm7mq1","name":"Montagem Lanterna ","x":39.14602966211002,"y":33.50450372498512,"w":13.452093360653159,"h":12.794638778912002,"color":"#000"},
  {"id":"na20ls1","name":"Montagem Farol","x":57.33670980155325,"y":32.47070569151259,"w":13.877927266976144,"h":13.93468454654878,"color":"#000"},
  {"id":"xr2td0d","name":"Metalização moldura","x":72.02820003619397,"y":32.91840391804613,"w":6.745209336065329,"h":5.140045767636771,"color":"#111111"},
  {"id":"zatz5ck","name":"Injeção Moldura","x":79.24788308820304,"y":32.159954409677994,"w":11.931866834897065,"h":5.3029094487277035,"color":"#111111"},
  {"id":"94xf29w","name":"Kanban","x":76.97626560209777,"y":40.172428629376476,"w":14.30376117329915,"h":6.605818897455421,"color":"#111111"},
  {"id":"eodewhq","name":"Almoxarifado","x":78.39091551725716,"y":49.60903611231422,"w":13.635202460188879,"h":6.091271653816776,"color":"#111111"},
  {"id":"e6ji4sk","name":"Laboratório","x":78.87002759201293,"y":57.30673831390214,"w":10.686210671306924,"h":6.325727362181929,"color":"#111111"},
  {"id":"ar3l32f","name":"CT","x":77.69129317244085,"y":76.04167064210212,"w":8.359249329758981,"h":18.76533041886107,"color":"#111111"},
  {"id":"ouoxpsl","name":"Mont. Reposção","x":92.25882265144018,"y":50.41753355062801,"w":4,"h":10.65623690750489,"color":"#111111"},
  {"id":"jjujq8r","name":"Pequenos ","x":88.63094466425706,"y":68.84208893085346,"w":8.134048257372669,"h":26.734041141375727,"color":"#111111"},
  {"id":"vgoi1s8","name":"Injeção","x":78.69218682748998,"y":20.877377319343264,"w":10.207327971403046,"h":9.234390274577578,"color":"#111111"},
  {"id":"o1g893g","name":"Metalização","x":69.9753441090501,"y":22.311488958450145,"w":8.645218945487088,"h":7.703170823732712,"color":"#111111"},
  {"id":"nta3he6","name":"Envernização","x":52.30184890081389,"y":20.89314190883554,"w":8.216264521894587,"h":5.42184663292743,"color":"#111111"},
  {"id":"1u0x4f9","name":"Envernização","x":61.37388833287524,"y":22.209250242272276,"w":8.28775692582667,"h":8.04679426294716,"color":"#111111"},
  {"id":"bcllnj3","name":"Central de materiais ","x":19.13000100189664,"y":6.737119199418212,"w":11.361930294906163,"h":10.9843553612574,"color":"#000"},
  {"id":"9yrbtve","name":"Metalização Plastico","x":18.55709116255173,"y":27.20911058899159,"w":15.426273458445102,"h":6.828188280392865,"color":"#111111"},
  {"id":"kq258nr","name":"Plastico","x":7.2598082979403955,"y":27.11550236056639,"w":9.217158176943697,"h":7.062438901689681,"color":"#111111"},
  {"id":"swtpf7m","name":"RH","x":31.30281769264146,"y":50.44131388976015,"w":4,"h":4,"color":"#111111"},
  {"id":"2z5e472","name":"DAF","x":35.18267380899293,"y":53.8084657426837,"w":2,"h":5,"color":"#111111"},
  {"id":"rogz2jj","name":"Expedição montadora","x":38.32263540083972,"y":49.15537328440902,"w":13.138516532618475,"h":6.937561098310368,"color":"#111111"},
  {"id":"xewjd65","name":"Embarque controlado","x":51.67946650349253,"y":49.121705973010634,"w":5,"h":7.828048627112189,"color":"#111111"},
  {"id":"h2wqajl","name":"Expedição ","x":57.961519248154374,"y":48.860922142054974,"w":11.35120643431646,"h":6.937561098310354,"color":"#111111"},
  {"id":"4b2brqh","name":"Recebimento","x":70.41654696528916,"y":48.86805624379459,"w":7.286863270777516,"h":6.624947630019804,"color":"#111111"},
  {"id":"dio7e06","name":"Inj. reposição","x":79.04876809787162,"y":64.81107416531161,"w":7.000893655049111,"h":4,"color":"#111111"},
  {"id":"zumkuhf","name":"Embalagem","x":41.930426275186974,"y":21.40997320545146,"w":5,"h":9.453135910412549,"color":"#111111"},
  {"id":"zsnhxoi","name":"Injeção LPP","x":51.820430601054895,"y":27.624000104310877,"w":8.68621067130692,"h":4.32572736218193,"color":"#111111"},
  {"id":"d6il34z","name":"Ambulatorio","x":32.48274966631388,"y":41.522062500636615,"w":6,"h":4,"color":"#111111"},
  {"id":"zxqnki4","name":"Segurança","x":77.95197529693783,"y":71.98369796330113,"w":4,"h":4,"color":"#111111"},
  {"id":"qyq28s3","name":"Patrimonial","x":28.636386208606094,"y":55.633880054153636,"w":6.4150222788033275,"h":4,"color":"#111111"},
  {"id":"j77zoa7","name":"Recepção","x":33.67223380246654,"y":61.15322654853297,"w":5,"h":4,"color":"#111111"},
  {"id":"gzfy853","name":"Central","x":53.2710142447266,"y":32.93598554184995,"w":3,"h":8.052402544049173,"color":"#111111"}
];

/** ===== TIPOS E ESTADO ===== */
type DataCfg = { table: string; locationCol: string; typeCol: string };
type Handle = "nw" | "ne" | "sw" | "se";

type DragState =
  | { kind: "none" }
  | { kind: "move"; id: string; startX: number; startY: number; sx: number; sy: number }
  | { kind: "resize"; id: string; startX: number; startY: number; sx: number; sy: number; edge: Handle };

type SectorAgg = { total: number; byType: Record<string, number> };

const uid = () => Math.random().toString(36).slice(2, 9);
const normalize = (s: any) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** normaliza nome de coluna (sem acento/caixa) */
const normKey = (s: string) =>
  s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase() : "";

/** tenta casar "localização" -> "Localização" etc. */
function bestMatchColumn(available: string[], desired: string): string {
  if (!desired) return "";
  let hit =
    available.find((c) => c === desired) ||
    available.find((c) => c.toLowerCase() === desired.toLowerCase());
  if (hit) return hit;
  const nd = normKey(desired);
  hit = available.find((c) => normKey(c) === nd);
  if (hit) return hit;
  const variants = [desired, desired.replace(/ç/g, "c")];
  for (const v of variants) {
    hit = available.find((c) => normKey(c) === normKey(v));
    if (hit) return hit;
  }
  return "";
}

/** precisa citar no PostgREST? (acentos/maiúsculas/espaços) */
const needsQuote = (s: string) => /[^a-z0-9_]/i.test(s) || s !== s.toLowerCase();
/** cita a coluna para usar no select/order/or */
const qcol = (s: string) => (s && needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** candidatos para auto-detectar coluna de localização */
const AUTO_LOC_CANDS = [
  "Localização","localização","Localizacao","localizacao",
  "Setor","Setor_nome","Setor Nome","Local","Localizacao"
];

export default function SetoresMapa() {
  const navigate = useNavigate();

  /** ===== ORIGEM DO LAYOUT ===== */
  const [useSystemDefault, setUseSystemDefault] = useState<boolean>(() => {
    const raw = localStorage.getItem("setores_use_system_default");
    return raw ? raw === "1" : true;
  });
  useEffect(() => {
    localStorage.setItem("setores_use_system_default", useSystemDefault ? "1" : "0");
  }, [useSystemDefault]);

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loadingDefault, setLoadingDefault] = useState(false);

  const fetchSystemDefault = async () => {
    setLoadingDefault(true);
    try {
      const r = await fetch(DEFAULT_URL, { cache: "no-cache" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json)) throw new Error("JSON inválido (esperado array)");
      setSectors(json as Sector[]);
      setSelectedId(null);
    } catch (e) {
      console.warn("Falha ao carregar layout padrão do sistema; usando fallback embutido.", e);
      setSectors(DEFAULT_LAYOUT_FALLBACK);
      setSelectedId(null);
    } finally {
      setLoadingDefault(false);
    }
  };

  useEffect(() => {
    if (useSystemDefault) {
      fetchSystemDefault();
    } else {
      try {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (Array.isArray(local) && local.length) setSectors(local);
        else fetchSystemDefault();
      } catch {
        fetchSystemDefault();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useSystemDefault]);

  useEffect(() => {
    if (!useSystemDefault) localStorage.setItem(STORAGE_KEY, JSON.stringify(sectors));
  }, [sectors, useSystemDefault]);

  /** ===== FONTE DE DADOS (contagens) ===== */
  const [cfg, setCfg] = useState<DataCfg>(() => {
    try {
      return JSON.parse(localStorage.getItem(CFG_KEY) || "{}") as DataCfg;
    } catch {
      return { table: "", locationCol: "", typeCol: "" };
    }
  });
  useEffect(() => {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }, [cfg]);

  // lista de tabelas
  const [tables, setTables] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        setLoadingTables(true);
        let { data, error } = await supabase.schema("api").from("tabelas_disponiveis").select("*");
        if (error) {
          const rpc = await supabase.rpc("list_tables");
          data = (rpc.data as any[]) ?? null;
          error = rpc.error as any;
        }
        if (error) throw error;

        const publicTables = (data ?? [])
          .filter((t: any) => String(t.schemaname || "").toLowerCase() === "public")
          .map((t: any) => String(t.tablename || "").replace(/^public\./i, ""))
          .filter(Boolean);

        const dedup = Array.from(new Set(publicTables)).sort((a, b) => a.localeCompare(b));
        setTables(dedup);
      } catch (e) {
        console.error(e);
        setTables([]);
      } finally {
        setLoadingTables(false);
      }
    })();
  }, []);

  // detectar colunas disponíveis
  const [availableCols, setAvailableCols] = useState<string[]>([]);
  const [colsResolvedAt, setColsResolvedAt] = useState<number>(0);
  const fetchAvailableCols = async () => {
    if (!cfg.table) { setAvailableCols([]); return; }
    try {
      const { data, error } = await supabase.from(cfg.table).select("*").limit(1);
      if (error) throw error;
      const row = (data as any[])?.[0] ?? {};
      const keys = Object.keys(row);
      setAvailableCols(keys);
      setColsResolvedAt(Date.now());

      // Auto-seleciona "Localização" se o usuário não tiver configurado ainda
      if (!cfg.locationCol) {
        const guessed = AUTO_LOC_CANDS.map(c => bestMatchColumn(keys, c)).find(Boolean) || "";
        if (guessed) setCfg(prev => ({ ...prev, locationCol: guessed }));
      }
    } catch {
      setAvailableCols([]);
      setColsResolvedAt(Date.now());
    }
  };
  useEffect(() => {
    fetchAvailableCols();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.table]);

  // IMPORTANTE: só consideramos coluna resolvida se ELA EXISTE.
  const resolvedLocationCol = useMemo(() => {
    return cfg.locationCol ? bestMatchColumn(availableCols, cfg.locationCol) : "";
  }, [cfg.locationCol, availableCols]);

  const resolvedTypeCol = useMemo(() => {
    return cfg.typeCol ? bestMatchColumn(availableCols, cfg.typeCol) : "";
  }, [cfg.typeCol, availableCols]);

  const [loadingAgg, setLoadingAgg] = useState(false);
  const [agg, setAgg] = useState<Record<string, SectorAgg>>({});

  const loadAggregation = async () => {
    if (!cfg.table || !resolvedLocationCol) return;
    try {
      setLoadingAgg(true);
      const colsArr = [resolvedLocationCol, resolvedTypeCol].filter(Boolean);
      const cols = colsArr.map(qcol).join(","); // cita nomes com acento/maiúscula
      const { data, error } = await supabase.from(cfg.table).select(cols).limit(10000);
      if (error) throw error;

      const map: Record<string, SectorAgg> = {};
      for (const r of (data as any[])) {
        const locKey = normalize(r?.[resolvedLocationCol]);
        if (!locKey) continue;
        const tRaw = resolvedTypeCol ? r?.[resolvedTypeCol] : undefined;
        map[locKey] ??= { total: 0, byType: {} };
        map[locKey].total++;
        if (tRaw != null)
          map[locKey].byType[String(tRaw)] = (map[locKey].byType[String(tRaw)] || 0) + 1;
      }
      setAgg(map);
    } catch (e: any) {
      console.error(e);
      alert(
        `Falha ao carregar inventário por localização: ${e?.message || e}\n` +
          (availableCols.length ? `Dica: colunas detectadas: ${availableCols.join(", ")}` : "") +
          `\nUsando localização: ${resolvedLocationCol || "(não resolvida)"}${
            resolvedTypeCol ? ` • tipo: ${resolvedTypeCol}` : ""
          }`
      );
    } finally {
      setLoadingAgg(false);
    }
  };
  useEffect(() => {
    if (cfg.table) loadAggregation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.table, resolvedLocationCol, resolvedTypeCol, colsResolvedAt]);

  /** ===== DRAG infra ===== */
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "none" });
  const selected = useMemo(() => sectors.find((s) => s.id === selectedId) || null, [sectors, selectedId]);

  const toPercent = (clientX: number, clientY: number) => {
    const box = imgRef.current?.getBoundingClientRect();
    if (!box) return { xp: 0, yp: 0 };
    return { xp: ((clientX - box.left) / box.width) * 100, yp: ((clientY - box.top) / box.height) * 100 };
  };
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const startMove = (e: React.MouseEvent | React.TouchEvent, s: Sector) => {
    if (!editMode) return;
    const p = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    const { xp, yp } = toPercent(p.clientX, p.clientY);
    setDrag({ kind: "move", id: s.id, startX: xp, startY: yp, sx: s.x, sy: s.y });
  };
  const startResize = (e: React.MouseEvent | React.TouchEvent, s: Sector, edge: Handle) => {
    if (!editMode) return;
    e.stopPropagation();
    const p = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    const { xp, yp } = toPercent(p.clientX, p.clientY);
    setDrag({ kind: "resize", id: s.id, startX: xp, startY: yp, sx: s.x, sy: s.y, edge });
  };

  const onPointerMove = (clientX: number, clientY: number) => {
    if (drag.kind === "none") return;
    const i = sectors.findIndex((s) => s.id === drag.id);
    if (i < 0) return;
    const { xp, yp } = toPercent(clientX, clientY);
    const dx = xp - drag.startX, dy = yp - drag.startY;

    setSectors((arr) => {
      const cur = { ...arr[i] };
      if (drag.kind === "move") {
        cur.x = clamp(drag.sx + dx, 0, 100 - cur.w);
        cur.y = clamp(drag.sy + dy, 0, 100 - cur.h);
      } else {
        const minW = 6, minH = 4;
        if (drag.edge === "nw") {
          const nx = clamp(drag.sx + dx, 0, cur.x + cur.w - minW);
          const ny = clamp(drag.sy + dy, 0, cur.y + cur.h - minH);
          cur.w += cur.x - nx; cur.h += cur.y - ny; cur.x = nx; cur.y = ny;
        } else if (drag.edge === "ne") {
          const ny = clamp(drag.sy + dy, 0, cur.y + cur.h - minH);
          cur.h += cur.y - ny; cur.y = ny; cur.w = clamp(cur.w + dx, minW, 100 - cur.x);
        } else if (drag.edge === "sw") {
          const nx = clamp(drag.sx + dx, 0, cur.x + cur.w - minW);
          cur.w += cur.x - nx; cur.x = nx; cur.h = clamp(cur.h + dy, minH, 100 - cur.y);
        } else {
          cur.w = clamp(cur.w + dx, minW, 100 - cur.x);
          cur.h = clamp(cur.h + dy, minH, 100 - cur.y);
        }
      }
      const next = [...arr]; next[i] = cur; return next;
    });
  };
  const endDrag = () => setDrag({ kind: "none" });

  useEffect(() => {
    const onMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; if (t) onPointerMove(t.clientX, t.clientY); };
    const onUp = () => endDrag();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [drag, sectors]);

  /** ===== Modal / abrir setor ===== */
  const [openSector, setOpenSector] = useState<Sector | null>(null);
  const openSectorInfo = (s: Sector) => { if (!editMode) setOpenSector(s); };
  const closeSectorInfo = () => setOpenSector(null);

  /** ===== helpers UI ===== */
  const updateSelected = (patch: Partial<Sector>) => {
    if (!selected) return;
    setSectors((arr) => arr.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));
  };

  return (
    <section className="card p-3 md:p-4">
      {/* Toolbar principal */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
        <h1 className="text-lg font-semibold">Setores (Mapa Interativo)</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setUseSystemDefault(true)}
            className={`px-3 py-2 rounded-lg border text-sm ${useSystemDefault ? "bg-black text-white" : "bg-white"}`}
          >
            🔒 Usar padrão do sistema
          </button>

          <button
            onClick={() => setUseSystemDefault(false)}
            className={`px-3 py-2 rounded-lg border text-sm ${!useSystemDefault ? "bg-blue-600 text-white" : "bg-white"}`}
          >
            ✏️ Usar meu layout local
          </button>

          <button
            onClick={fetchSystemDefault}
            className="px-3 py-2 rounded-lg border text-sm bg-white"
            disabled={loadingDefault}
          >
            {loadingDefault ? "Carregando padrão…" : "Recarregar padrão"}
          </button>

          {/* Edição apenas quando for layout local */}
          <button
            onClick={() => setEditMode((v) => !v)}
            disabled={useSystemDefault}
            className={`px-3 py-2 rounded-lg border text-sm ${editMode ? "bg-blue-600 text-white" : "bg-white"} ${useSystemDefault ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {editMode ? "🔧 Editando" : "✏️ Editar layout"}
          </button>

          <button
            onClick={() => {
              const s: Sector = { id: uid(), name: "Novo setor", x: 20, y: 20, w: 18, h: 10, color: "#111" };
              setSectors((a) => [...a, s]);
              setSelectedId(s.id);
              setEditMode(true);
            }}
            disabled={useSystemDefault}
            className={`px-3 py-2 rounded-lg border text-sm bg-white ${useSystemDefault ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            ➕ Novo setor
          </button>

          <button
            onClick={() => {
              if (selected) {
                const d = { ...selected, id: uid(), name: selected.name + " (cópia)", x: Math.min(selected.x + 2, 95), y: Math.min(selected.y + 2, 95) };
                setSectors((a) => [...a, d]);
                setSelectedId(d.id);
              }
            }}
            disabled={!selected || useSystemDefault}
            className="px-3 py-2 rounded-lg border text-sm bg-white disabled:opacity-50"
          >
            ⧉ Duplicar
          </button>

          <button
            onClick={() => {
              if (selected) {
                setSectors((a) => a.filter((s) => s.id !== selected.id));
                setSelectedId(null);
              }
            }}
            disabled={!selected || useSystemDefault}
            className="px-3 py-2 rounded-lg border text-sm bg-white text-red-600 disabled:opacity-50"
          >
            🗑️ Excluir
          </button>

          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(sectors, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "setores-layout.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            className="px-3 py-2 rounded-lg border text-sm bg-white"
          >
            ⤓ Exportar
          </button>

          <button
            onClick={() => {
              const i = document.createElement("input");
              i.type = "file";
              i.accept = "application/json";
              i.onchange = async () => {
                const f = i.files?.[0];
                if (!f) return;
                try {
                  const json = JSON.parse(await f.text()) as Sector[];
                  setSectors(json);
                  setSelectedId(null);
                } catch (e: any) {
                  alert("Importação inválida: " + (e?.message || e));
                }
              };
              i.click();
            }}
            disabled={useSystemDefault}
            className={`px-3 py-2 rounded-lg border text-sm bg-white ${useSystemDefault ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            ⤒ Importar
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_360px] gap-3">
        {/* Canvas do mapa */}
        <div className="relative w-full overflow-hidden rounded-xl border bg-gray-50" style={{ minHeight: 360 }}>
          <img
            ref={imgRef}
            src={MAP_IMAGE_SRC}
            alt="Planta da empresa"
            className="w-full h-auto block select-none pointer-events-none"
            onDragStart={(e) => e.preventDefault()}
          />

          {/* Overlays de setores */}
          {sectors.map((s) => {
            const a = agg[normalize(s.name)];
            const total = a?.total ?? 0;
            return (
              <div
                key={s.id}
                className="absolute group select-none"
                style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%` }}
                onMouseDown={(e) => { if (!editMode) return; setSelectedId(s.id); startMove(e, s); }}
                onTouchStart={(e) => { if (!editMode) return; setSelectedId(s.id); startMove(e, s); }}
                onClick={() => { if (!editMode) openSectorInfo(s); else setSelectedId(s.id); }}
              >
                <div
                  className="w-full h-full rounded-lg bg-white/70 backdrop-blur-[1px] flex items-center justify-center text-center px-2 border-2 shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
                  style={{ borderColor: s.color || (selectedId === s.id ? "#2563eb" : "#111"), borderWidth: selectedId === s.id ? 3 : 2 }}
                >
                  <div className="leading-tight">
                    <div className="text-[12px] font-semibold text-gray-900">{s.name}</div>
                    {!editMode && (
                      <div className="mt-1 text-[11px] text-gray-700">
                        {cfg.table && resolvedLocationCol ? `${total} item(ns)` : ""}
                      </div>
                    )}
                  </div>
                </div>

                {editMode && (
                  <>
                    <ResizeHandle pos="nw" onDown={(e) => startResize(e, s, "nw")} />
                    <ResizeHandle pos="ne" onDown={(e) => startResize(e, s, "ne")} />
                    <ResizeHandle pos="sw" onDown={(e) => startResize(e, s, "sw")} />
                    <ResizeHandle pos="se" onDown={(e) => startResize(e, s, "se")} />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Lateral — FONTE DE DADOS */}
        <aside className="rounded-xl border bg-white p-3 space-y-3">
          <h3 className="text-sm font-semibold mb-2">Fonte de dados</h3>
          <div className="grid grid-cols-1 gap-2">
            <label className="block text-xs">
              <span className="block text-gray-500 mb-1">Tabela</span>
              <select
                className="w-full px-3 py-2 rounded border"
                value={cfg.table}
                onChange={(e) => setCfg({ ...cfg, table: e.target.value })}
              >
                <option value="">{loadingTables ? "Carregando..." : "— nenhuma tabela selecionada —"}</option>
                {tables.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <LabeledInput
              label="Coluna de localização"
              value={cfg.locationCol}
              onChange={(v) => setCfg({ ...cfg, locationCol: v })}
              placeholder="ex.: Localização"
            />
            <LabeledInput
              label="Coluna de tipo (opcional)"
              value={cfg.typeCol}
              onChange={(v) => setCfg({ ...cfg, typeCol: v })}
              placeholder="ex.: Tipo"
            />

            <div className="text-[11px] text-gray-500">
              {cfg.table && (
                <>
                  {availableCols.length ? (
                    <>
                      <div>Colunas detectadas: {availableCols.join(", ")}</div>
                      <div>
                        Usando localização: <b>{resolvedLocationCol || "(não resolvida)"}</b>
                        {resolvedTypeCol && <> • tipo: <b>{resolvedTypeCol}</b></>}
                      </div>
                    </>
                  ) : (
                    <div>Não foi possível detectar colunas (tabela vazia ou sem acesso).</div>
                  )}
                </>
              )}
            </div>

            <button onClick={loadAggregation} className="px-3 py-2 rounded border text-sm bg-white">
              {loadingAgg ? "Atualizando…" : "Atualizar contagens"}
            </button>
          </div>
        </aside>
      </div>

      {/* Modal do setor — apenas visualização */}
      {openSector && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeSectorInfo} />
          <div className="relative w-full sm:w-[520px] max-h-[88vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold">Setor: {openSector.name}</h3>
              <button onClick={closeSectorInfo} className="text-gray-600 hover:text-gray-800">✕</button>
            </div>

            <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const url = `/explorar?table=${encodeURIComponent(cfg.table || "")}&q=${encodeURIComponent(openSector.name)}`;
                  navigate(url);
                }}
                className="h-11 rounded-xl border text-sm font-medium bg-white"
              >
                Abrir no Explorador
              </button>
            </div>

            <SectorTypeList
              title={resolvedTypeCol ? `Contagem por ${resolvedTypeCol}` : "Contagem por tipo"}
              data={(() => {
                const a = agg[normalize(openSector.name)];
                return a ? Object.entries(a.byType).sort((x, y) => x[0].localeCompare(y[0])) : [];
              })()}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/** ===== Subcomponentes ===== */
function SectorTypeList({ title, data }: { title: string; data: [string, number][] }) {
  if (!data.length) {
    return <div className="text-sm text-gray-600">Não há itens categorizados neste setor.</div>;
  }
  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <ul className="space-y-1">
        {data.map(([type, qty]) => (
          <li key={type} className="flex items-center justify-between text-sm border rounded px-3 py-2">
            <span className="truncate">{type}</span>
            <span className="text-xs px-2 py-0.5 rounded-full border border-gray-800">{qty}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResizeHandle({ pos, onDown }: { pos: Handle; onDown: (e: React.MouseEvent | React.TouchEvent) => void }) {
  const style: Record<string, string> = {
    position: "absolute",
    width: "14px",
    height: "14px",
    background: "#111",
    borderRadius: "9999px",
    border: "2px solid #fff",
  };
  if (pos === "nw") Object.assign(style, { left: "-7px", top: "-7px", cursor: "nwse-resize" });
  if (pos === "ne") Object.assign(style, { right: "-7px", top: "-7px", cursor: "nesw-resize" });
  if (pos === "sw") Object.assign(style, { left: "-7px", bottom: "-7px", cursor: "nesw-resize" });
  if (pos === "se") Object.assign(style, { right: "-7px", bottom: "-7px", cursor: "nwse-resize" });

  return (
    <div
      onMouseDown={onDown}
      onTouchStart={onDown}
      style={style as React.CSSProperties}
      className="shadow ring-1 ring-black/10"
    />
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="block text-gray-500 mb-1">{label}</span>
      <input
        className="w-full px-3 py-2 rounded border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
