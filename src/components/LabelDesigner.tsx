import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

/** Tipos públicos — você pode importar do TableBrowser */
export type Unit = 'mm' | 'px';
export type QrLevel = 'L' | 'M' | 'Q' | 'H';

export interface LabelSettings {
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
  extra1: string;
  extra2: string;

  // micro-ajustes
  offsetX: number;
  offsetY: number;
  scale: number;
  padding: number;
  gap: number;
  textMax: number;
  qrLevel: QrLevel;
  qrMargin: boolean;
}

export const DEFAULT_SETTINGS: LabelSettings = {
  unit: 'mm',
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
  extra1: '',
  extra2: '',

  offsetX: 0,
  offsetY: 0,
  scale: 1,
  padding: 1.0,
  gap: 2.0,
  textMax: 28,
  qrLevel: 'M',
  qrMargin: true,
};

/** helpers exportados para reuso */
export function boxSizeCss(v: number, unit: Unit) { return `${v}${unit}`; }
export function pxIfMm(v: number, unit: Unit) {
  if (unit === 'px') return Math.max(16, Math.round(v));
  return Math.max(16, Math.round(v * 3.78)); // 1mm ≈ 3.78px @96dpi
}

/** Props do Designer */
type Props = {
  open: boolean;
  row: Record<string, any> | null;
  settings: LabelSettings;
  onSettingsChange: (s: LabelSettings) => void;
  onClose: () => void;
  onPrint: (row: Record<string, any>) => void;
  getEditUrl: (r: Record<string, any>) => string;
};

export default function LabelDesigner({
  open, row, settings, onSettingsChange, onClose, onPrint, getEditUrl,
}: Props) {
  if (!open || !row) return null;

  const id = row.id ?? row.ID ?? row.Id ?? row.iD;
  const nome = row.nome ?? row.NOME ?? row.Name ?? '';
  const idInv = row.idInventario ?? row.ID_INVENTARIO ?? row.id_inventario ?? '';
  const url = getEditUrl(row);

  const unit = settings.unit;
  const qrPx = pxIfMm(settings.qrSize, unit);
  const fontPx = pxIfMm(settings.fontSize, unit);

  const set = (p: Partial<LabelSettings>) => onSettingsChange({ ...settings, ...p });

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto h-full w-full sm:w-[560px] bg-white shadow-xl p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Designer de Etiqueta</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
        </div>

        {/* Controles */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Unidade</label>
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 border rounded ${settings.unit==='mm'?'bg-blue-50 border-blue-300':'bg-white'}`}
                onClick={()=>set({ unit:'mm' })}
              >mm</button>
              <button
                className={`px-3 py-1 border rounded ${settings.unit==='px'?'bg-blue-50 border-blue-300':'bg-white'}`}
                onClick={()=>set({ unit:'px' })}
              >px</button>
            </div>
          </div>

          <NumberField label="Largura" value={settings.width} unit={unit} onChange={(v)=>set({width:v})}/>
          <NumberField label="Altura" value={settings.height} unit={unit} onChange={(v)=>set({height:v})}/>
          <NumberField label="Margem (página)" value={settings.margin} unit={unit} onChange={(v)=>set({margin:v})}/>
          <NumberField label="Tamanho do QR" value={settings.qrSize} unit={unit} onChange={(v)=>set({qrSize:v})}/>
          <NumberField label="Fonte base" value={settings.fontSize} unit={unit} onChange={(v)=>set({fontSize:v})}/>
          <NumberField label="Altura da linha" value={settings.lineHeight} unit="" step={0.05} onChange={(v)=>set({lineHeight:v})}/>

          {/* Micro-ajustes */}
          <NumberField label="Offset X" value={settings.offsetX} unit={unit} step={0.1} onChange={(v)=>set({offsetX:v})}/>
          <NumberField label="Offset Y" value={settings.offsetY} unit={unit} step={0.1} onChange={(v)=>set({offsetY:v})}/>
          <NumberField label="Escala" value={settings.scale} unit="×" step={0.001} onChange={(v)=>set({scale: v || 1})}/>
          <NumberField label="Padding interno" value={settings.padding} unit={unit} step={0.1} onChange={(v)=>set({padding:v})}/>
          <NumberField label="Gap (QR↔texto)" value={settings.gap} unit={unit} step={0.1} onChange={(v)=>set({gap:v})}/>
          <NumberField label="Texto máx. largura" value={settings.textMax} unit={unit} step={0.5} onChange={(v)=>set({textMax:v})}/>

          <div className="col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">QR – Nível</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={settings.qrLevel}
                onChange={(e)=>set({ qrLevel: e.target.value as QrLevel })}
              >
                <option value="L">L (baixa)</option>
                <option value="M">M</option>
                <option value="Q">Q</option>
                <option value="H">H (alta)</option>
              </select>
            </div>
            <Check label="QR com margem (quiet zone)" checked={settings.qrMargin} onChange={(v)=>set({qrMargin:v})}/>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-2">
            <Check label="Mostrar nome" checked={settings.showName} onChange={(v)=>set({showName:v})}/>
            <Check label="Mostrar ID" checked={settings.showId} onChange={(v)=>set({showId:v})}/>
            <Check label="Mostrar Inventário" checked={settings.showInventory} onChange={(v)=>set({showInventory:v})}/>
            <Check label="Mostrar URL" checked={settings.showUrl} onChange={(v)=>set({showUrl:v})}/>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Linha extra 1</label>
            <input className="w-full border rounded px-2 py-1" value={settings.extra1} onChange={(e)=>set({extra1:e.target.value})}/>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Linha extra 2</label>
            <input className="w-full border rounded px-2 py-1" value={settings.extra2} onChange={(e)=>set({extra2:e.target.value})}/>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Preview</h4>
          <div
            className="border rounded bg-white"
            style={{ width: boxSizeCss(settings.width, unit), height: boxSizeCss(settings.height, unit), position: 'relative', overflow: 'hidden' }}
            title="Preview (escala aproximada)"
          >
            <div
              className="absolute top-0 left-0"
              style={{
                transform: `translate(${settings.offsetX}${unit}, ${settings.offsetY}${unit}) scale(${settings.scale})`,
                transformOrigin: 'top left',
                padding: `${settings.padding}${unit}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: `${settings.gap}${unit}` }}>
                <QRCodeCanvas value={url} size={qrPx} includeMargin={settings.qrMargin} level={settings.qrLevel}/>
                <div style={{ fontSize: fontPx, lineHeight: String(settings.lineHeight), maxWidth: boxSizeCss(settings.textMax, unit) }}>
                  {settings.showName && nome ? <div><strong>{String(nome)}</strong></div> : null}
                  {settings.showId && (id ?? '') !== '' ? <div>ID: {String(id)}</div> : null}
                  {settings.showInventory && (idInv ?? '') !== '' ? <div>Inv.: {String(idInv)}</div> : null}
                  {settings.extra1 ? <div>{settings.extra1}</div> : null}
                  {settings.extra2 ? <div>{settings.extra2}</div> : null}
                  {settings.showUrl ? <div className="text-[11px] text-gray-600 break-all">{url}</div> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button onClick={printCalibration} className="px-3 py-2 rounded border">Imprimir grade de calibração</button>
          <button onClick={onClose} className="px-3 py-2 rounded border">Fechar</button>
          <button onClick={()=>onPrint(row)} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Imprimir</button>
        </div>
      </div>
    </div>
  );
}

/* Subcomponentes simples */
function NumberField({
  label, value, onChange, unit, step
}: { label: string; value: number; onChange: (v:number)=>void; unit: string; step?: number }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label} {unit && <span className="text-gray-400">({unit})</span>}</label>
      <input
        type="number"
        step={step ?? 1}
        className="w-full border rounded px-2 py-1"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e)=>onChange(Number(e.target.value))}
      />
    </div>
  );
}
function Check({label, checked, onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" className="rounded border-gray-300" checked={checked} onChange={(e)=>onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/* Impressão da grade de calibração */
function printCalibration(){
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Calibração</title>
<style>
  @media print { @page { size: auto; margin: 5mm; } body { margin: 0; } }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial; }
  .wrap { padding: 8mm; }
  .title { margin-bottom: 6mm; }
  .grid {
    width: 100mm; height: 100mm; position: relative; border: 1px solid #000; box-sizing: content-box;
    background-image:
      linear-gradient(to right, rgba(0,0,0,0.25) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.25) 1px, transparent 1px);
    background-size: 10mm 10mm, 10mm 10mm;
  }
  .rulerX, .rulerY { position: absolute; font-size: 10pt; }
  .rulerX { top: -6mm; left: 0; right: 0; display: flex; justify-content: space-between; }
  .rulerY { top: 0; left: -8mm; bottom: 0; display: flex; flex-direction: column; justify-content: space-between; }
  .tick { color:#000; }
  .note { margin-top: 6mm; font-size: 11pt; }
</style>
</head>
<body onload="window.print(); setTimeout(()=>window.close(), 600);">
  <div class="wrap">
    <h3 class="title">Grade de calibração – 100 × 100 mm</h3>
    <div class="grid">
      <div class="rulerX">
        ${Array.from({length:11}).map((_,i)=>`<span class="tick">${i*10}</span>`).join('')}
      </div>
      <div class="rulerY">
        ${Array.from({length:11}).map((_,i)=>`<span class="tick">${i*10}</span>`).join('')}
      </div>
    </div>
    <p class="note">Meça o lado impresso com uma régua. Se der diferente de 100&nbsp;mm, ajuste a <b>Escala</b>
    (ex.: 99&nbsp;mm ⇒ escala = 100/99 ≈ 1.0101) e use Offset X/Y para centralizar.</p>
  </div>
</body>
</html>`;
  const w = window.open('', '_blank', 'width=520,height=660');
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}
