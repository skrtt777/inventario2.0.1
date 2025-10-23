// src/pages/RowEditor.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../services/supabase";

type Row = Record<string, any>;

const needsQuote = (s: string) => /[^a-z0-9_]/i.test(s) || s !== s.toLowerCase();
const qcol = (s: string) => (s && needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s);
const escOr = (s: string) => String(s).replace(/,/g, "\\,"); // vírgulas no .or()

const ID_CANDIDATES_BASE = [
  "id","ID","Id","iD","uuid","guid",
  "ID_inventario","idinventario","id_inventario",
  "tombo","patrimonio","patrimônio","serial","num_serie","n_serie"
];

export default function RowEditor() {
  const { table = "", id = "" } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState<string[]>([]);
  const [row, setRow] = useState<Row | null>(null);
  const [matchCol, setMatchCol] = useState<string>(""); // coluna usada para localizar o registro
  const [error, setError] = useState<string | null>(null);

  // carrega colunas (amostra 1 linha)
  async function fetchCols() {
    try {
      const { data, error } = await supabase.from(table).select("*").limit(1);
      if (error) throw error;
      const keys = Object.keys((data as any[])?.[0] ?? {});
      setCols(keys);
    } catch (e: any) {
      setCols([]);
    }
  }

  // tenta achar o registro por várias colunas
  async function fetchRow() {
    setLoading(true);
    setError(null);
    try {
      // 1) tenta por "id" direto (caso comum)
      let tryDirect = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (!tryDirect.error && tryDirect.data) {
        setRow(tryDirect.data as Row);
        setMatchCol("id");
        return;
      }

      // 2) busca colunas para montar OR dinâmico
      await fetchCols();
      const candidates = [
        ...ID_CANDIDATES_BASE,
        ...cols.filter(c => /^id(_|$)/i.test(c) || /^ID(_|$)/.test(c))
      ].filter((c, i, arr) => arr.indexOf(c) === i && cols.includes(c)); // únicos e existentes

      if (candidates.length === 0) {
        throw new Error("Não foi possível detectar uma coluna de ID compatível.");
      }

      const orExpr = candidates.map(c => `${qcol(c)}.eq.${escOr(id)}`).join(",");
      const { data, error } = await supabase.from(table).select("*").or(orExpr).limit(1);
      if (error) throw error;

      const found = (data as any[])?.[0];
      if (!found) throw new Error(`Registro ${id} não encontrado em ${table}.`);
      setRow(found);

      // define qual coluna bateu com o ID
      const hit = candidates.find(c => String(found[c]) === String(id)) || candidates[0];
      setMatchCol(hit);
    } catch (e: any) {
      setError(e?.message || String(e));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRow(); /* eslint-disable-next-line */ }, [table, id]);

  const [draft, setDraft] = useState<Row>({});
  useEffect(() => { setDraft(row ?? {}); }, [row]);

  const keys = useMemo(() => Object.keys(draft || {}), [draft]);

  async function save() {
    if (!row) return;
    try {
      setLoading(true);
      setError(null);
      // Atualiza pelo campo que localizou o registro
      const { error } = await supabase.from(table).update(draft).eq(matchCol || "id", id);
      if (error) throw error;
      alert("Registro salvo com sucesso.");
      navigate(-1);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="container mx-auto max-w-3xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Editar: {table} / {id}</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="px-3 py-2 rounded border">Voltar</button>
          <button onClick={save} disabled={!row || loading} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">Salvar</button>
        </div>
      </div>

      {loading && <div>Carregando…</div>}
      {error && <div className="p-2 rounded border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>}

      {row && (
        <div className="space-y-3">
          {keys.map((k) => (
            <label key={k} className="block">
              <span className="block text-xs text-gray-600 mb-1">{k}</span>
              <input
                className="w-full px-3 py-2 rounded border"
                value={draft[k] ?? ""}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}

      {!loading && !row && !error && (
        <div className="text-gray-600">Registro não encontrado.</div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        {matchCol && <>Registro localizado pela coluna <b>{matchCol}</b>.</>}
      </div>
    </section>
  );
}
