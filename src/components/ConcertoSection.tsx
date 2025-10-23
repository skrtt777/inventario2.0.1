// src/components/ConcertoSection.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

type Row = Record<string, any>;
const guessName = (row?: Row | null) => {
  if (!row) return "";
  const keys = Object.keys(row);
  const pick = (cands: string[]) => {
    const k = keys.find(kk => cands.some(c => kk.toLowerCase().includes(c.toLowerCase())));
    const v = k ? row[k] : "";
    return typeof v === "string" ? v : String(v ?? "");
  };
  return pick(["nome","name","descrição","descricao","título","titulo","modelo","produto"]);
};

export default function ConcertoSection({
  table, id, currentRow,
}: { table: string; id: string | number; currentRow?: Row | null }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any | null>(null);

  // modal do questionário
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{motivo: string; nota: string; previsao: string}>({
    motivo: "",
    nota: "",
    previsao: "", // YYYY-MM-DD
  });

  const itemLabel = useMemo(() => guessName(currentRow) || String(id), [currentRow, id]);

  // verifica se já existe concerto aberto (data_retorno IS NULL)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!table || !id) return;
      const { data, error } = await supabase
        .from("concerto")
        .select("*")
        .eq("table_name", table)
        .eq("item_id", String(id))
        .is("data_retorno", null)
        .order("data_envio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (error && error.code !== "PGRST116") setErr(error.message);
      setTicket(data ?? null);
    })();
    return () => { alive = false; };
  }, [table, id]);

  const goToTicket = (t: any) => t?.id && navigate(`/concerto?focus=${encodeURIComponent(String(t.id))}`);

  // Clique no botão principal
  const handleOpenClick = () => {
    setErr(null);
    if (ticket?.id) {
      // já existe concerto aberto → vai direto pra página
      return goToTicket(ticket);
    }
    // abre o questionário
    setDialogOpen(true);
  };

  // Confirmar questionário e criar o concerto
  const confirmCreate = async () => {
    try {
      setLoading(true);
      setErr(null);

      // payload básico + campos do questionário
      const payload: any = {
        table_name: table,
        item_id: String(id),
        item_label: itemLabel,
        status: "aberto",
        data_envio: new Date().toISOString(),
        motivo: form.motivo?.trim() || null,
        nota: form.nota?.trim() || null,
        // previsao é opcional; mantemos como date-only (YYYY-MM-DD)
        previsao_retorno: form.previsao?.trim() ? form.previsao.trim() : null,
      };

          const { data, error } = await supabase
        .from("concerto_com_status")
        .select("*")
        .order("enviado_em", { ascending: false });

      if (error) throw error;

      setTicket(data);
      setDialogOpen(false);
      goToTicket(data);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-amber-300/70 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-amber-900">Conserto / Reparos</h3>
          {ticket ? (
            <p className="text-sm text-amber-800">
              Existe um conserto aberto
              {ticket?.data_envio ? ` desde ${new Date(ticket.data_envio).toLocaleString("pt-BR")}` : ""}.
            </p>
          ) : (
            <p className="text-sm text-amber-800">Nenhum conserto aberto para este item.</p>
          )}
          {err && <p className="text-sm text-rose-700 mt-2">Erro: {err}</p>}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleOpenClick}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {ticket ? "Abrir tela de concerto" : (loading ? "Criando…" : "Enviar para concerto")}
          </button>
        </div>
      </div>

      {/* Modal do questionário */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDialogOpen(false)} />
          <div className="relative mx-auto my-10 w-[min(560px,95vw)] bg-white rounded-xl shadow-xl border p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">Abrir concerto</h4>
              <button onClick={() => setDialogOpen(false)} className="text-gray-600 hover:text-gray-800">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Motivo</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ex.: diagnóstico, não liga, tela quebrada…"
                  value={form.motivo}
                  onChange={(e) => setForm((s) => ({ ...s, motivo: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Nota</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="Número da nota (minuta)"
                  value={form.nota}
                  onChange={(e) => setForm((s) => ({ ...s, nota: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Previsão de retorno (opcional)</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={form.previsao}
                  onChange={(e) => setForm((s) => ({ ...s, previsao: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded border"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmCreate}
                  disabled={loading}
                  className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {loading ? "Salvando…" : "Salvar e abrir concerto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
