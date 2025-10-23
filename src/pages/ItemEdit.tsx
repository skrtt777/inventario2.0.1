// src/pages/ItemEdit.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/services/supabase";

type Row = Record<string, any>;
type ScalarType = "text" | "number" | "boolean" | "date" | "unknown";
type FieldDef = { name: string; type: ScalarType; label: string };

type RepairModalState = {
  open: boolean;
  motivo: string;
  fornecedor: string;
  nota: string;
  dataSaida: string;
  saving: boolean;
  err: string | null;
};

function typeGuess(v: any): ScalarType {
  if (v === null || v === undefined) return "unknown";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") {
    // ISO yyyy-mm-dd(Thh:mm:ss)
    if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?/.test(v)) return "date";
    if (!isNaN(Number(v)) && v.trim() !== "") return "number";
    return "text";
  }
  return "unknown";
}

function niceLabel(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function todayLocalISODate(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function ItemEdit() {
  const { table, id } = useParams<{ table: string; id: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  // coluna usada para match (id, patrimonio, id_inventario, etc.)
  const ik = sp.get("ik") || "id";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});

  const makeRepairState = (): RepairModalState => ({
    open: false,
    motivo: "",
    fornecedor: "",
    nota: "",
    dataSaida: todayLocalISODate(),
    saving: false,
    err: null,
  });
  const [repairModal, setRepairModal] = useState<RepairModalState>(makeRepairState());

  const openRepairModal = () => {
    if (!row) return;
    setRepairModal({ ...makeRepairState(), open: true });
  };

  const closeRepairModal = () => {
    setRepairModal(makeRepairState());
  };

  const idIsInt = useMemo(() => /^\d+$/.test(id ?? ""), [id]);

  // Monta URL de retorno preservando filtros/estado e ancora no item
  // Monta URL de retorno preservando filtros/estado e ancora no item
  const backHref = useMemo(() => {
    const makeAnchorId = (raw: string | number) =>
      `r-${String(raw).trim().replace(/[^A-Za-z0-9_.:-]/g, "-")}`;
    const keyVal = (row as any)?.[ik] ?? id;
    const anchor = keyVal != null ? `#${makeAnchorId(keyVal)}` : "";
    const qs = new URLSearchParams(window.location.search || "");
    if (table && !qs.has("table")) qs.set("table", table);
    qs.delete("ik");
    qs.delete("sb_url");
    qs.delete("sb_key");
    const search = qs.toString() ? `?${qs.toString()}` : "";
    return `/explorar${search}${anchor}`;
  }, [row, ik, id, table]);

  const loadItem = useCallback(async () => {
    if (!table || !id) return;
    setLoading(true);
    setError(null);
    setRow(null);

    try {
      const tryMatch = async (matchVal: any) => {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq(ik, matchVal)
          .maybeSingle();
        if (error) throw error;
        return data as Row | null;
      };

      let data = await tryMatch(idIsInt ? Number(id) : id);

      // fallback: se nÃƒÂ£o achou e tentamos nÃƒÂºmero, tenta string
      if (!data && idIsInt) {
        data = await tryMatch(String(id));
      }

      if (!data) {
        setError(
          `Item nÃƒÂ£o encontrado (${id}). Detalhes: TypeError: Load failed`
        );
      } else {
        setRow(data);
        setForm(data);
      }
    } catch (e: any) {
      const msg =
        e?.message || e?.error_description || e?.details || String(e);
      setError(`Falha ao carregar item. Detalhes: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [table, id, ik, idIsInt]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const fields = useMemo(() => {
    if (!row) return [] as FieldDef[];
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const keyMap = new Map<string, string>();
    Object.keys(row).forEach((k) => keyMap.set(norm(k), k));

    const SPECS: { label: string; keys: string[] }[] = [
      { label: 'Ativo', keys: ['ativo'] },
      { label: 'ComentÃƒÂ¡rio', keys: ['comentario','comentÃƒÂ¡rio','observacao','observaÃƒÂ§ÃƒÂ£o','observacoes','observaÃƒÂ§ÃƒÂµes','coment','comentarios'] },
      { label: 'Entidade', keys: ['entidade','empresa','org','organizacao','organizaÃƒÂ§ÃƒÂ£o'] },
      { label: 'Fabricante', keys: ['fabricante','marca'] },
      { label: 'LocalizaÃƒÂ§ÃƒÂ£o', keys: ['localizacao','localizaÃƒÂ§ÃƒÂ£o','local','setor','sala'] },
      { label: 'Modelo', keys: ['modelo'] },
      { label: 'Nome', keys: ['nome','name','descricao','descriÃƒÂ§ÃƒÂ£o','titulo','tÃƒÂ­tulo','produto'] },
      { label: 'Numero de Serie', keys: ['numero_serie','num_serie','n_serie','serial','serie'] },
      { label: 'rede', keys: ['rede','network','ssid'] },
      { label: 'Status', keys: ['status','situacao','situaÃƒÂ§ÃƒÂ£o','state'] },
      { label: 'Tipo', keys: ['tipo','categoria','category'] },
      { label: 'Ultima AtualizaÃƒÂ§ÃƒÂ£o', keys: ['updated_at','updatedat','ultima_atualizacao','ultima atualizacao','ultima atualizaÃƒÂ§ÃƒÂ£o','last_update','updated'] },
    ];

    const out: FieldDef[] = [];
    for (const spec of SPECS) {
      let picked: string | null = null;
      for (const cand of spec.keys) {
        const k = keyMap.get(norm(cand));
        if (k) { picked = k; break; }
      }
      if (picked) {
        out.push({ name: picked, label: spec.label, type: typeGuess(row[picked]) });
      }
    }
    return out;
  }, [row]);

  // Label amigavel por nome de coluna (corrige possiveis "mojibake")
  const uiLabelFor = (name: string, fallback: string) => {
    const slug = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const labels = new Map<string, string>([
      ['ativo', 'Ativo'],
      ['comentario', 'Comentario'],
      ['observacao', 'Comentario'],
      ['entidade', 'Entidade'],
      ['empresa', 'Entidade'],
      ['org', 'Entidade'],
      ['organizacao', 'Entidade'],
      ['fabricante', 'Fabricante'],
      ['marca', 'Fabricante'],
      ['localizacao', 'Localizacao'],
      ['local', 'Localizacao'],
      ['setor', 'Localizacao'],
      ['sala', 'Localizacao'],
      ['modelo', 'Modelo'],
      ['nome', 'Nome'],
      ['descricao', 'Nome'],
      ['titulo', 'Nome'],
      ['numero_serie', 'Numero de Serie'],
      ['num_serie', 'Numero de Serie'],
      ['n_serie', 'Numero de Serie'],
      ['serial', 'Numero de Serie'],
      ['rede', 'Rede'],
      ['status', 'Status'],
      ['situacao', 'Status'],
      ['tipo', 'Tipo'],
      ['updated_at', 'Ultima Atualizacao'],
      ['updatedat', 'Ultima Atualizacao'],
      ['ultima_atualizacao', 'Ultima Atualizacao'],
      ['ultima atualizacao', 'Ultima Atualizacao'],
      ['last_update', 'Ultima Atualizacao'],
    ]);
    return labels.get(slug) || fallback;
  };

  function coerceValue(type: ScalarType, v: any) {
    if (v === "" || v === null || v === undefined) return null;
    switch (type) {
      case "number":
        return Number(v);
      case "boolean":
        return Boolean(v);
      case "date":
        // MantÃƒÂ©m string ISO/Date-Only; backend aceita texto ISO
        return String(v);
      default:
        return String(v);
    }
  }

  async function save() {
    if (!table || !id || !row) return;
    setSaving(true);
    setError(null);
    try {
      // Monta payload: mantÃƒÂ©m tipos coerentes com os originais
      const payload: Row = {};
      for (const f of fields) {
        payload[f.name] = coerceValue(f.type, form[f.name]);
      }

      // Usa o valor atual do registro para garantir tipo/valor exatos da coluna-chave
      const currentKeyVal = (row as any)?.[ik];
      const matchVal = currentKeyVal !== undefined && currentKeyVal !== null
        ? currentKeyVal
        : (idIsInt ? Number(id) : id);

      // Retorna representaÃƒÂ§ÃƒÂ£o para sabermos se houve update
      const resp = await supabase
        .from(table)
        .update(payload)
        .eq(ik, matchVal)
        .select();
      if (resp.error) throw resp.error;
      const updated = Array.isArray(resp.data) ? resp.data : [];
      if (!updated.length) {
        throw new Error(`Nenhuma linha atualizada (tabela=${table}, chave=${ik}, valor=${String(matchVal)})`);
      }

      // Atualiza estado com linha retornada
      setRow(updated[0] as Row);
      setForm(updated[0] as Row);
      setToast({ type: 'success', msg: 'Salvo com sucesso.' });
      setTimeout(() => setToast(null), 2500);
    } catch (e: any) {
      const msg = e?.message || e?.error_description || e?.details || String(e);
      const full = `Falha ao salvar: ${msg}`;
      setError(full);
      setToast({ type: 'error', msg: full });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  function renderInput(name: string, type: ScalarType) {
    const value = form?.[name];

    if (type === "boolean") {
      return (
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={Boolean(value)}
          onChange={(e) =>
            setForm((s) => ({ ...s, [name]: e.target.checked }))
          }
        />
      );
    }

    if (type === "number") {
      return (
        <input
          type="number"
          className="w-full rounded border px-3 py-2"
          value={value ?? ""}
          onChange={(e) =>
            setForm((s) => ({ ...s, [name]: e.target.value }))
          }
        />
      );
    }

    if (type === "date") {
      // suporta date e datetime simples
      const asStr = value ?? "";
      const onlyDate =
        typeof asStr === "string" && asStr.length >= 10
          ? asStr.slice(0, 10)
          : todayLocalISODate();
      return (
        <input
          type="date"
          className="w-full rounded border px-3 py-2"
          value={onlyDate}
          onChange={(e) =>
            setForm((s) => ({ ...s, [name]: e.target.value }))
          }
        />
      );
    }

    // text / unknown / objetos -> textarea se for json
    if (value && typeof value === "object") {
      return (
        <textarea
          className="w-full rounded border px-3 py-2 font-mono text-sm"
          rows={4}
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setForm((s) => ({ ...s, [name]: parsed }));
            } catch {
              setForm((s) => ({ ...s, [name]: e.target.value }));
            }
          }}
        />
      );
    }

    return (
      <input
        type="text"
        className="w-full rounded border px-3 py-2"
        value={value ?? ""}
        onChange={(e) => setForm((s) => ({ ...s, [name]: e.target.value }))}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 mb-4">
                <button
          onClick={() => navigate(backHref)}
          className="rounded border px-3 py-2 hover:bg-gray-50"
        >
          Voltar
        </button>
        <h1 className="text-xl font-semibold">
          Gestao de Inventario <span className="mx-1">-</span>
          <span className="text-gray-600">Editar</span>
          <span className="mx-1">-</span>
          <span className="font-mono">{table}</span>
        </h1>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-700 mb-6">
          <div className="font-semibold mb-1">Falha ao carregar item</div>
          <div className="mb-3">{error}</div>
          <div className="text-sm text-rose-800">
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirme se o QR foi gerado para a tabela correta.</li>
              <li>
                Se o QR usa um identificador que nÃƒÂ£o ÃƒÂ© a coluna <code>id</code>,
                adicione <code>?ik=&lt;coluna&gt;</code> ÃƒÂ  URL (ex.:{" "}
                <code>?ik=patrimonio</code>).
              </li>
              <li>
                Gere novos QRs usando sempre a mesma coluna de identificaÃƒÂ§ÃƒÂ£o
                do item (<code>id</code>, <code>patrimonio</code>,{" "}
                <code>id_inventario</code>, etc.).
              </li>
            </ul>
          </div>
        </div>
      )}

      {loading && (
        <div className="p-6 text-gray-600">Carregando...</div>
      )}

      {!loading && row && (
        <>
          <div className="mb-6 text-sm text-gray-600">
            <span className="mr-2">Chave:</span>
            <code className="px-2 py-1 rounded bg-gray-100 border">{ik}</code>
            <span className="mx-2">-</span>
            <span className="mr-2">Valor:</span>
            <code className="px-2 py-1 rounded bg-gray-100 border">{id}</code>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {fields.map((f) => (
              <div key={f.name} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <label className="text-sm text-gray-700">{uiLabelFor(f.name, f.label)}</label>
                <div className="sm:col-span-2">{renderInput(f.name, f.type)}</div>
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-4">
              <Link
                to={backHref}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={saving}
                onClick={(e) => { e.preventDefault(); save(); }}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </form>
          {toast && (
            <div className={`fixed top-4 right-4 z-50 rounded shadow-md border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="text-sm">{toast.msg}</span>
                {toast.type === 'success' && (
                  <Link
                    to={backHref}
                    className="px-2 py-1 rounded border bg-white/60 hover:bg-white text-sm"
                  >
                    Voltar para a lista
                  </Link>
                )}
                <button
                  onClick={() => setToast(null)}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}








