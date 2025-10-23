// src/pages/WifiMapa.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
type AP = {
  id: string;
  name: string;
  x: number; // % (0-100)
  y: number; // % (0-100)
  r: number; // raio em % da largura
  color: string; // hex
  ix?: number; // posição do íícone (%), default = x
  iy?: number; // posição do íícone (%), default = y
  ssid?: string; // nome da rede (SSID)
  rede?: string; // AbWLANAUTO | ARTEB_MOBILE | ARTEB_GUEST
  ip?: string;   // IP do AP
  iconSize?: number; // tamanho do íícone em px
  ringWidth?: number; // espessura da borda do círculo (px)
  labelFont?: number; // font-size do rótulo (px)
  kind?: 'wifi' | 'server'; // tipo do ponto
};
const STORAGE_KEY = "wifi_mapa_v1";
const IMG_KEY = "wifi_img_url_v1";
const ICON_URL = "/891896.svg"; // ícone da antena Wi‑Fi (em public/)
const ICON_SERVER_URL = "/server-storage.svg"; // ícone do servidor (em public/)
const DEFAULT_IMG = "/Planta_4_invertida.png";
// Preset padrão (pode ser preenchido via JSON abaixo)
const DEFAULT_APS: AP[] = [{ id: "22a1m9g", name: "Plástico ", x: 87.11755233494365, y: 65.30823955235277, ix: 87.11755233494365, iy: 65.30823955235277, r: 5.347826086956516, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "7fvm6oh", name: "Plástico  metalização", x: 73.33655394524963, y: 65.8249147578957, ix: 73.33655394524963, iy: 65.8249147578957, r: 5.449275362318829, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "eg408w0", name: "Central de material ", x: 74.90713902308109, y: 81.9555351682497, ix: 74.90713902308109, iy: 81.9555351682497, r: 5.341921631776685, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "2ieadzh", name: "Montagem Lanterna", x: 54.255501878690325, y: 58.036386128263366, ix: 54.255501878690325, iy: 58.036386128263366, r: 5.449275362318851, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "3uwi4f1", name: "Montagem farol", x: 36.12667740203977, y: 57.850433799589815, ix: 36.12667740203977, iy: 57.850433799589815, r: 5.409554482018237, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "cq2k1dy", name: "Embarque controlado", x: 49.81427804616215, y: 46.29611434802963, ix: 49.81427804616215, iy: 46.29611434802963, r: 5.200751476113773, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "o0qke9i", name: "Expedição", x: 36.838432635534126, y: 46.578580375500415, ix: 36.838432635534126, iy: 46.578580375500415, r: 5.463231347289302, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "c7172rw", name: "Recebimento", x: 26.814814814814856, y: 47.0171858550193, ix: 26.814814814814856, iy: 47.0171858550193, r: 5.429414922168533, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "h5gqo4w", name: "Almoxarifado", x: 15.395598497047816, y: 46.51895462224954, ix: 15.395598497047816, iy: 46.51895462224954, r: 5.3022007514761, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "qsquit1", name: "Montagem reposição", x: 6.660225442834184, y: 44.2251196909265, ix: 6.660225442834184, iy: 44.2251196909265, r: 5.107353730542123, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "37php0r", name: "Lente", x: 17.288244766505677, y: 69.98812927886473, ix: 17.288244766505677, iy: 69.98812927886473, r: 5.3022007514761, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 },{ id: "czhrjer", name: "Metalização refletores (LPP)", x: 30.077294685990374, y: 70.50480448440769, ix: 30.077294685990374, iy: 70.50480448440769, r: 5.5705850778314385, color: "#0ea5e9", ssid: "", rede: "AbWLANAUTO", ip: "", iconSize: 48, ringWidth: 2, labelFont: 11 }];
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
export default function WifiMapa() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string>(() => {
    try { return localStorage.getItem(IMG_KEY) || DEFAULT_IMG; } catch { return DEFAULT_IMG; }
  });
  const [aps, setAps] = useState<AP[]>(() => { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length) return parsed as AP[]; } } catch {} return DEFAULT_APS; });
  const [editMode, setEditMode] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState<'wifi' | 'server'>('wifi');
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<
    | { kind: "none" }
    | { kind: "move"; id: string; startX: number; startY: number; sx: number; sy: number }
    | { kind: "resize"; id: string; startX: number; sx: number; sr: number }
    | { kind: "icon"; id: string; startX: number; startY: number; six: number; siy: number }
  >({ kind: "none" });
  useEffect(() => { try { localStorage.setItem(IMG_KEY, imgUrl); } catch {} }, [imgUrl]);
  // Migração suave: normaliza imagens antigas (planta.png/planta_2.png) para /Planta_4_invertida.png
  useEffect(() => {
    try {
      if (!imgUrl) return;
      const old = /\/(planta|planta_2)\.png$/i.test(imgUrl);
      if (old) setImgUrl("/Planta_4_invertida.png");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(aps)); } catch {} }, [aps]);
  const selectedAP = useMemo(() => aps.find(a => a.id === selected) || null, [aps, selected]);
  const toPercent = (clientX: number, clientY: number) => {
    const box = imgRef.current?.getBoundingClientRect();
    if (!box) return { xp: 0, yp: 0 };
    return { xp: ((clientX - box.left) / box.width) * 100, yp: ((clientY - box.top) / box.height) * 100 };
  };
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const onMapClick = (e: React.MouseEvent) => {
    if (!editMode || !adding) return;
    const { xp, yp } = toPercent(e.clientX, e.clientY);
    const name = prompt("Nome do ponto de acesso (SSID ou local)", "AP-") || "AP";
    const color = "#0ea5e9"; // sky-500
    const cx = clamp(xp, 0, 100);
    const cy = clamp(yp, 0, 100);
    setAps(arr => [
      ...arr,
      {
        id: uid(),
        name,
        x: cx,
        y: cy,
        ix: cx,
        iy: cy,
        r: 5,
        color,
        ssid: "",
        rede: "AbWLANAUTO",
        ip: "",
        iconSize: 48,
        ringWidth: 2,
        labelFont: 11,
        kind: newKind,
      },
    ]);
    setAdding(false);
  };
  const startMove = (e: React.MouseEvent, ap: AP) => {
    if (!editMode) return;
    e.stopPropagation();
    const { xp, yp } = toPercent(e.clientX, e.clientY);
    setDrag({ kind: "move", id: ap.id, startX: xp, startY: yp, sx: ap.x, sy: ap.y });
  };
  const startResize = (e: React.MouseEvent, ap: AP) => {
    if (!editMode) return;
    e.stopPropagation();
    const { xp } = toPercent(e.clientX, e.clientY);
    setDrag({ kind: "resize", id: ap.id, startX: xp, sx: ap.x, sr: ap.r });
  };
  const startIconMove = (e: React.MouseEvent, ap: AP) => {
    if (!editMode) return;
    e.stopPropagation();
    const { xp, yp } = toPercent(e.clientX, e.clientY);
    const six = ap.ix ?? ap.x;
    const siy = ap.iy ?? ap.y;
    setDrag({ kind: "icon", id: ap.id, startX: xp, startY: yp, six, siy });
  };
  const onPointerMove = (clientX: number, clientY: number) => {
    if (drag.kind === "none") return;
    const i = aps.findIndex(a => a.id === drag.id);
    if (i < 0) return;
    if (drag.kind === "move") {
      const { xp, yp } = toPercent(clientX, clientY);
      const dx = xp - drag.startX, dy = yp - drag.startY;
      const x = clamp(drag.sx + dx, 0, 100);
      const y = clamp(drag.sy + dy, 0, 100);
      setAps(arr => { const next = [...arr]; next[i] = { ...next[i], x, y }; return next; });
    } else if (drag.kind === "resize") {
      const { xp } = toPercent(clientX, clientY);
      const dx = xp - drag.startX;
      const r = clamp(drag.sr + dx, 1, 100);
      setAps(arr => { const next = [...arr]; next[i] = { ...next[i], r }; return next; });
    } else if (drag.kind === "icon") {
      const { xp, yp } = toPercent(clientX, clientY);
      const dx = xp - drag.startX, dy = yp - drag.startY;
      const ix = clamp(drag.six + dx, 0, 100);
      const iy = clamp(drag.siy + dy, 0, 100);
      // Vincula o centro da cobertura à posição do íícone
      setAps(arr => { const next = [...arr]; next[i] = { ...next[i], ix, iy, x: ix, y: iy }; return next; });
    }
  };
  const endDrag = () => setDrag({ kind: "none" });
  useEffect(() => {
    const onMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
    const onUp = () => endDrag();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, aps]);
  const removeAP = (id: string) => setAps(arr => arr.filter(a => a.id !== id));
  const duplicateAP = (id: string) => {
    const ap = aps.find(a => a.id === id); if (!ap) return;
    setAps(arr => [...arr, { ...ap, id: uid(), x: clamp(ap.x + 2, 0, 100), y: clamp(ap.y + 2, 0, 100), ix: clamp((ap.ix ?? ap.x) + 2, 0, 100), iy: clamp((ap.iy ?? ap.y) + 2, 0, 100), name: ap.name + " (copia)" }]);
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ imgUrl, aps }, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = "wifi-mapa.json"; a.click(); URL.revokeObjectURL(u);
  };
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const obj = JSON.parse(String(r.result)); if (obj.imgUrl) setImgUrl(obj.imgUrl); if (Array.isArray(obj.aps)) setAps(obj.aps); } catch {}
    };
    r.readAsText(f);
    e.target.value = "";
  };
  // Popup de informações ao clicar no íícone
  const [popupId, setPopupId] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!popupRef.current) return;
      const target = e.target as Node;
      if (!popupRef.current.contains(target)) setPopupId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  return (
    <section className="card p-3 md:p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
        <h1 className="text-lg font-semibold">Mapa Wi‑Fi</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={imgUrl}
            onChange={(e) => setImgUrl(e.target.value)}
            placeholder="URL da planta (imagem)"
            className="px-3 py-2 rounded border w-[320px] max-w-[70vw]"
          />
          <button onClick={() => setEditMode(v => !v)} className={`px-3 py-2 rounded border text-sm ${editMode ? "bg-blue-600 text-white" : "bg-white"}`}>{editMode ? "Editando" : "Visualizar"}</button>
          <div className="flex items-center gap-2">
            <select
              value={newKind}
              onChange={(e) => setNewKind((e.target.value as 'wifi' | 'server') || 'wifi')}
              className="px-2 py-2 rounded border text-sm bg-white"
              title="Tipo do próximo ponto"
            >
              <option value="wifi">Wi‑Fi</option>
              <option value="server">Servidor</option>
            </select>
            <button onClick={() => setAdding(true)} disabled={!editMode} className="px-3 py-2 rounded border text-sm bg-white disabled:opacity-50">Adicionar</button>
          </div>
          <button onClick={() => exportJson()} className="px-3 py-2 rounded border text-sm bg-white">Exportar</button>
          <label className="px-3 py-2 rounded border text-sm bg-white cursor-pointer">
            Importar
            <input type="file" accept="application/json" className="hidden" onChange={importJson} />
          </label>
          <button onClick={() => { if (confirm("Limpar todos os APs?")) setAps([]); }} className="px-3 py-2 rounded border text-sm bg-white">Limpar</button>
        </div>
      </div>
      <div className="relative w-full overflow-hidden rounded border">
        {/* Imagem de fundo */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img ref={imgRef} src={imgUrl} className="block w-full select-none" onClick={onMapClick} />
        {/* Overlay de APs */}
        <div className="pointer-events-none absolute inset-0">
          {aps.map((ap) => {
            const imgW = imgRef.current?.getBoundingClientRect().width || 0;
            const diameterPx = Math.max(8, Math.round(((ap.r ?? 1) * 2 * imgW) / 100));
            return (<>
              <div key={ap.id} className="absolute" style={{ left: `${ap.x}%`, top: `${ap.y}%`, transform: "translate(-50%, -50%)" }}>
                {/* área do sinal */}
                <div
                  className="pointer-events-auto relative"
                  onWheel={(e) => {
                    if (!editMode) return;
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -1 : 1;
                    setAps(arr => {
                      const idx = arr.findIndex(a => a.id === ap.id);
                      if (idx < 0) return arr;
                      const cur = arr[idx];
                      const r = clamp((cur.r ?? 5) + delta, 1, 100);
                      const next = [...arr];
                      next[idx] = { ...cur, r };
                      return next;
                    });
                  }}
                  onMouseDown={(e) => startMove(e, ap)}
                  title={`Raio: ${Math.round(ap.r)}%`}
                >
                    <div
                      className="rounded-full"
                      style={{
                        width: `${diameterPx}px`,
                        height: `${diameterPx}px`,
                        border: `${Math.max(1, ap.ringWidth ?? 2)}px solid ${ap.color}`,
                        backgroundColor: hexToRgba(ap.color, 0.08),
                      }}
                    />
                {/* �ícone da antena Wi‑Fi */}
                <img
                  src={ICON_URL}
                  alt="AP Wi‑Fi"
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
                  style={{ width: 0, height: 0, display: "none" }}
                  draggable={false}
                />
                  {/* handle de raio */}
                  {editMode && (
                    <div
                      onMouseDown={(e) => startResize(e, ap)}
                      className="absolute rounded-full bg-white border-2 shadow -right-3 top-1/2 -translate-y-1/2 w-5 h-5 cursor-ew-resize"
                      style={{ borderColor: ap.color, boxShadow: "0 0 0 2px rgba(255,255,255,0.8)" }}
                      title="Arraste para ajustar o raio"
                    />
                  )}
                  {/* r�tulo (abaixo do �ícone) */}
                  {((ap.name ?? "").trim().length > 0) && (
                    <div className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 border"
                         style={{ borderColor: ap.color, top: "calc(50% + 16px)", fontSize: (ap.labelFont ?? 11), padding: `${Math.max(2, Math.round((ap.labelFont ?? 11) * 0.2))}px ${Math.max(4, Math.round((ap.labelFont ?? 11) * 0.5))}px` }}>
                      {ap.name}
                    </div>
                  )}
                </div>
              </div>
                {/* íícone e popup (posição independente = ix,iy) */}
                <div className="absolute" style={{ left: `${(ap.ix ?? ap.x)}%`, top: `${(ap.iy ?? ap.y)}%`, transform: "translate(-50%, -50%)" }}>
                  <div className="pointer-events-auto relative">
                    <img
                      src={(ap.kind === 'server') ? ICON_SERVER_URL : ICON_URL}
                      alt="AP Wi-Fi"
                      className="block select-none cursor-move"
                      style={{ width: `${(ap.iconSize ?? 24)}px`, height: `${(ap.iconSize ?? 24)}px` }}
                      draggable={false}
                      onMouseDown={(e) => startIconMove(e, ap)}
                      onWheel={(e) => {
                        if (!editMode) return;
                        e.preventDefault();
                        const step = e.ctrlKey ? 5 : 2;
                        const delta = e.deltaY > 0 ? -step : step;
                        setAps(arr => {
                          const idx = arr.findIndex(a => a.id === ap.id);
                          if (idx < 0) return arr;
                          const cur = arr[idx];
                          const size = Math.max(12, Math.min(128, (cur.iconSize ?? 24) + delta));
                          const next = [...arr];
                          next[idx] = { ...cur, iconSize: size };
                          return next;
                        });
                      }}
                      onClick={(e) => { e.stopPropagation(); setPopupId(ap.id); }}
                    />
                    {popupId === ap.id && (
                      <div
                        ref={popupRef}
                        className="absolute z-20 -translate-x-1/2 -translate-y-full -mt-2 left-1/2 top-0 bg-white border rounded shadow-lg p-2 w-56 text-sm"
                        style={{ pointerEvents: 'auto' }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium truncate" title={ap.name}>{ap.name}</div>
                          <button onClick={() => setPopupId(null)} className="text-slate-500 hover:text-slate-800">×</button>
                        </div>
                        <div className="mt-1 text-slate-600 space-y-2">
                          <div className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full" style={{ background: ap.color }} /> Cor: <span className="font-mono">{ap.color}</span></div>
                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <label className="text-xs text-slate-500">Raio (%)</label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={Math.round(ap.r)}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                                setAps(arr => arr.map(a => a.id === ap.id ? { ...a, r: val } : a));
                              }}
                              className="w-14 px-1 py-0.5 rounded border text-xs"
                            />
                            <input
                              type="range"
                              min={1}
                              max={100}
                              value={Math.round(ap.r)}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 1;
                                setAps(arr => arr.map(a => a.id === ap.id ? { ...a, r: val } : a));
                              }}
                              className="col-span-2"
                            />
                          </div>
                          <div>SSID: <span className="font-mono">{ap.ssid && ap.ssid.trim() ? ap.ssid : '-'}</span></div>
                          <div>Rede: <span className="font-mono">{ap.rede && ap.rede.trim() ? ap.rede : '-'}</span></div>
                          <div>IP: <span className="font-mono">{ap.ip && ap.ip.trim() ? ap.ip : '-'}</span></div>
                        </div>
                        <div className="mt-2 flex gap-2 justify-end">
                          <button onClick={() => { setSelected(ap.id); setPopupId(null); }} className="px-2 py-1 rounded border text-xs">Editar</button>
                          <button onClick={() => { duplicateAP(ap.id); setPopupId(null); }} className="px-2 py-1 rounded border text-xs">Duplicar</button>
                          <button onClick={() => { removeAP(ap.id); setPopupId(null); }} className="px-2 py-1 rounded border text-xs">Remover</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            </>)
          })}
        </div>
      </div>
      {/* Lista lateral simples (abaixo no mobile) */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 text-sm text-slate-600">
          <p>Dica: ative "Editando" para arrastar os pontos e ajustar o raio (cobertura aproximada). Os dados ficam salvos no navegador.</p>
        </div>
        <div className="border rounded p-2 text-sm">
          <div className="font-medium mb-2">Pontos de acesso</div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {aps.map((ap) => (
              <div key={ap.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded ${selected === ap.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <button onClick={() => setSelected(ap.id)} className="text-left flex-1 truncate">
                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: ap.color }} />
                  {ap.name}
                </button>
                <button onClick={() => duplicateAP(ap.id)} className="px-2 py-0.5 rounded border text-xs">Duplicar</button>
                <button onClick={() => removeAP(ap.id)} className="px-2 py-0.5 rounded border text-xs">Remover</button>
              </div>
            ))}
            {aps.length === 0 && <div className="text-slate-500">Nenhum AP adicionado</div>}
          </div>
          {selectedAP && (
            <div className="mt-3 space-y-2">
              <div className="text-slate-600 font-medium">Editar AP</div>
              <label className="flex items-center gap-2">
                <span className="w-24">Tipo</span>
                <select
                  value={selectedAP.kind ?? 'wifi'}
                  onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, kind: (e.target.value as 'wifi'|'server') } : a))}
                  className="px-2 py-1 rounded border"
                >
                  <option value="wifi">Wi‑Fi</option>
                  <option value="server">Servidor</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Nome</span>
                <input value={selectedAP.name} onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, name: e.target.value } : a))} className="flex-1 px-2 py-1 rounded border" />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Raio (%)</span>
                <input type="number" min={1} max={100} value={selectedAP.r} onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, r: clamp(Number(e.target.value) || 1, 1, 100) } : a))} className="w-24 px-2 py-1 rounded border" />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Cor</span>
                <input type="color" value={selectedAP.color} onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, color: e.target.value } : a))} />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Borda (px)</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedAP.ringWidth ?? 2}
                  onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, ringWidth: Math.max(1, Math.min(12, Number(e.target.value) || 2)) } : a))}
                  className="w-24 px-2 py-1 rounded border"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Texto (px)</span>
                <input
                  type="number"
                  min={8}
                  max={24}
                  value={selectedAP.labelFont ?? 11}
                  onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, labelFont: Math.max(8, Math.min(24, Number(e.target.value) || 11)) } : a))}
                  className="w-24 px-2 py-1 rounded border"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Íícone (px)</span>
                <input type="number" min={12} max={128} value={selectedAP.iconSize ?? 24} onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, iconSize: Math.max(12, Math.min(128, Number(e.target.value) || 24)) } : a))} className="w-24 px-2 py-1 rounded border" />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">SSID</span>
                <input value={selectedAP.ssid ?? ''} onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, ssid: e.target.value } : a))} className="flex-1 px-2 py-1 rounded border" placeholder="Ex.: AbWLAN-AP03" />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Rede</span>
                <select value={selectedAP.rede ?? 'AbWLANAUTO'} onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, rede: e.target.value } : a))} className="px-2 py-1 rounded border">
                  <option value="AbWLANAUTO">AbWLANAUTO</option>
                  <option value="ARTEB_MOBILE">ARTEB_MOBILE</option>
                  <option value="ARTEB_GUEST">ARTEB_GUEST</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">IP</span>
                <input value={selectedAP.ip ?? ''} onChange={(e) => setAps(arr => arr.map(a => a.id === selectedAP.id ? { ...a, ip: e.target.value } : a))} className="flex-1 px-2 py-1 rounded border" placeholder="Ex.: 10.10.10.21" />
              </label>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function hexToRgba(hex: string, alpha: number) {
  try {
    const h = hex.replace("#", "");
    const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return `rgba(14, 165, 233, ${alpha})`; // sky-500 fallback
  }
}




