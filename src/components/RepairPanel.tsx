import { useState } from "react";
import { supabase } from "@/services/supabase";

export function RepairPanel({
  table,
  row,
  itemId,
  itemLabel,
  idKey,
  statusKey,
  onDone,
}: {
  table: string;
  row: any;
  itemId: string | number;
  itemLabel: string;
  idKey: string;
  statusKey: string;
  onDone: (ticketId: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [nota, setNota] = useState("");
  const [dataSaida, setDataSaida] = useState<string>(todayLocalISO());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const salvar = async () => {
    try {
      setSaving(true);
      setErr(null);

      const payload: any = {
        table_name: table,
        item_id: String(itemId),
        item_label: itemLabel || String(itemId),
        id_key: idKey,
        status_key: statusKey,
        item_snapshot: row,
        status: "aberto",
        // TIMESTAMPTZ
        enviado_em: new Date().toISOString(),
        // >>> conforme seu pedido: gravar em data_saida (DATE)
        data_saida: dataSaida || null,
        // campos livres
        motivo: motivo?.trim() || null,
        fornecedor: fornecedor?.trim() || null,
        nota: nota?.trim() || null,
      };

      const { data, error } = await supabase
        .from("concerto")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // best-effort: marcar item como EM_CONCERTO
      try {
        const match = /^\d+$/.test(String(itemId)) ? Number(itemId) : String(itemId);
        await supabase.from(table).update({ [statusKey]: "EM_CONCERTO" }).eq(idKey, match);
      } catch {}

      onDone(String((data as any)?.id ?? ""));
    } catch (e: any) {
      setErr(e?.message || "Falha ao abrir concerto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <div className="text-sm text-slate-700">
          <div><span className="font-medium">Tabela:</span> {table}</div>
          <div><span className="font-medium">Item:</span> {itemLabel} (ID: {String(itemId)})</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Motivo</label>
          <input className="w-full border rounded px-3 py-2" value={motivo} onChange={e=>setMotivo(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Fornecedor</label>
            <input className="w-full border rounded px-3 py-2" value={fornecedor} onChange={e=>setFornecedor(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Nota</label>
            <input className="w-full border rounded px-3 py-2" value={nota} onChange={e=>setNota(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Data de saída (previsão)</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={dataSaida} onChange={e=>setDataSaida(e.target.value)} />
        </div>

        {err && <div className="p-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm">{err}</div>}
      </div>

      <div className="p-3 border-t flex justify-end">
        <button
          onClick={salvar}
          disabled={saving}
          className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar e abrir concerto"}
        </button>
      </div>
    </div>
  );
}

function todayLocalISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
