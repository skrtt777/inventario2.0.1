// src/pages/concerto.tsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabase";
import { useListURLState } from "../hooks/useListURLState";

/** ===================== Tipos ===================== */
type Repair = {
  id: string;
  table_name: string;
  item_id: string;
  motivo?: string | null;
  fornecedor?: string | null;
  nota?: string | null;
  enviado_em: string;          // timestamptz ISO
  data_saida?: string | null;  // DATE (yyyy-mm-dd)
  data_retorno?: string | null;// timestamptz ISO
  custo?: number | null;
  observacao?: string | null;

  // chaves/snapshot
  id_key?: string | null;      // nome da coluna de ID no item de origem
  status_key?: string | null;  // nome da coluna de status no item de origem
  item_label?: string | null;
  item_snapshot?: any;
  status?: string | null;
};

const BASE_URL =
  (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || window.location.origin;

const PAGE_KEY = "concertos_list_v1";

type Tab = "abertos" | "retornados" | "todos";
const parseFilters = (s?: string) => {
  try {
    return (s ? JSON.parse(s) : {}) as { tab?: Tab; [k: string]: any };
  } catch {
    return {} as { tab?: Tab };
  }
};
const stringifyFilters = (obj: any) => JSON.stringify(obj ?? {});

/** =============== helpers para chaves/estado item =============== */
function pickKeyFromSnapshot(
  snap: Record<string, any> | null | undefined,
  candidates: string[],
  fuzzyTerms: string[] = []
): string | null {
  if (!snap) return null;
  const keys = Object.keys(snap);
  const lower = keys.map(k => k.toLowerCase());

  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i >= 0) return keys[i];
  }
  for (const term of fuzzyTerms) {
    const i = lower.findIndex(k => k.includes(term.toLowerCase()));
    if (i >= 0) return keys[i];
  }
  return null;
}

function guessStatusKey(r: Repair): string {
  if (r.status_key && String(r.status_key).trim() !== "") return String(r.status_key);
  return (
    pickKeyFromSnapshot(r.item_snapshot, ["status", "situação", "situacao"], ["status", "situa"]) ||
    "status"
  );
}

function guessIdKey(r: Repair): string {
  if (r.id_key && String(r.id_key).trim() !== "") return String(r.id_key);
  return (
    pickKeyFromSnapshot(
      r.item_snapshot,
      ["id", "id_inventario", "idinventario", "tombo", "patrimonio", "uuid", "guid"],
      ["id_"]
    ) || "id"
  );
}

function readStatusFromSnapshot(r: Repair): string {
  const key = guessStatusKey(r);
  const v = r.item_snapshot?.[key];
  return v != null ? String(v) : "";
}

function parseMatchVal(raw: string) {
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

/** ======================== COMPONENTE ======================== */
export default function ConcertoPage() {
  const { state: urlState, update: updateURL } = useListURLState(PAGE_KEY, {
    q: "",
    page: 1,
    pageSize: 20,
    sort: JSON.stringify({ column: "enviado_em", direction: "desc" as const }),
    filters: stringifyFilters({ tab: "abertos" as Tab }),
  });

  const currentTab: Tab = useMemo(() => {
    const f = parseFilters(urlState.filters);
    return (f.tab as Tab) || "abertos";
  }, [urlState.filters]);

  const setTab = (t: Tab) => {
    const f = parseFilters(urlState.filters);
    updateURL({ filters: stringifyFilters({ ...f, tab: t }), page: 1 });
  };

  const page = Number(urlState.page) || 1;
  const pageSize = Number(urlState.pageSize) || 20;
  const [q, setQ] = useState(urlState.q || "");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Repair[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // modais
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<Repair | null>(null);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnRow, setReturnRow] = useState<Repair | null>(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusRow, setStatusRow] = useState<Repair | null>(null);
  const [statusValue, setStatusValue] = useState<string>("ATIVA");

  const menuRef = useRef<HTMLDivElement | null>(null);

  const [sort, setSort] = useState<{ column: keyof Repair; direction: "asc" | "desc" }>(() => {
    try {
      const s = JSON.parse(urlState.sort ?? "null");
      if (s?.column && (s.direction === "asc" || s.direction === "desc")) return s;
    } catch {}
    return { column: "enviado_em", direction: "desc" };
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // noop
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  /** -------------------- CARREGAR (da TABELA) -------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("concerto")
        .select("*", { count: "exact" })
        .order(sort.column as string, { ascending: sort.direction === "asc" })
        .range(from, to);

      if (currentTab === "abertos") {
        query = query.is("data_retorno", null);
      } else if (currentTab === "retornados") {
        query = query.not("data_retorno", "is", null);
      }

      if (q.trim()) {
        const term = q.trim();
        query = query.or(
          [
            `item_id.ilike.%${escapeComma(term)}%`,
            `table_name.ilike.%${escapeComma(term)}%`,
            `motivo.ilike.%${escapeComma(term)}%`,
            `fornecedor.ilike.%${escapeComma(term)}%`,
            `nota.ilike.%${escapeComma(term)}%`,
            `item_label.ilike.%${escapeComma(term)}%`,
          ].join(",")
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setRows((data ?? []) as Repair[]);
      setCount(count ?? 0);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar concertos.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, currentTab, sort]);

  useEffect(() => {
    load();
  }, [load]);

  /** -------------------- AÇÕES TICKET -------------------- */
  const openNew = () => {
    setEditRow({
      id: "",
      table_name: "",
      item_id: "",
      motivo: "",
      fornecedor: "",
      nota: "",
      enviado_em: new Date().toISOString(),
      data_saida: null,
      data_retorno: null,
      custo: null,
      observacao: "",
      id_key: null,
      status_key: null,
      item_label: "",
      item_snapshot: {},
      status: "aberto",
    });
    setDialogOpen(true);
  };

  const openEdit = (r: Repair) => {
    setEditRow({ ...r });
    setDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    try {
      setLoading(true);
      setError(null);
      const payload = {
        table_name: editRow.table_name?.trim(),
        item_id: String(editRow.item_id ?? "").trim(),
        motivo: emptyToNull(editRow.motivo),
        fornecedor: emptyToNull(editRow.fornecedor),
        nota: emptyToNull(editRow.nota),
        enviado_em: editRow.enviado_em ? new Date(editRow.enviado_em).toISOString() : new Date().toISOString(),
        data_saida: editRow.data_saida ? dateOnlyIso(editRow.data_saida) : null, // <- usa data_saida
        data_retorno: editRow.data_retorno ? new Date(editRow.data_retorno).toISOString() : null,
        custo: toNumberOrNull(editRow.custo),
        observacao: emptyToNull(editRow.observacao),
        id_key: emptyToNull(editRow.id_key),
        status_key: emptyToNull(editRow.status_key),
        item_label: emptyToNull(editRow.item_label),
        item_snapshot: editRow.item_snapshot ?? {},
        status: emptyToNull(editRow.status),
      };

      if (!payload.table_name || !payload.item_id) {
        setError("Informe a tabela e o ID do item.");
        setLoading(false);
        return;
      }

      if (!editRow.id) {
        const { error } = await supabase.from("concerto").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("concerto").update(payload).eq("id", editRow.id);
        if (error) throw error;
      }

      setDialogOpen(false);
      setEditRow(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "Não foi possível salvar.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async (r: Repair) => {
    if (!confirm("Excluir este registro de concerto?")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("concerto").delete().eq("id", r.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setError(e?.message || "Falha ao excluir.");
    } finally {
      setLoading(false);
    }
  };

  const openReturn = (r: Repair) => {
    setReturnRow({ ...r, data_retorno: new Date().toISOString() });
    setReturnOpen(true);
  };

  const saveReturn = async () => {
    if (!returnRow) return;
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase
        .from("concerto")
        .update({
          data_retorno: returnRow.data_retorno ? new Date(returnRow.data_retorno).toISOString() : new Date().toISOString(),
          custo: toNumberOrNull(returnRow.custo),
          observacao: emptyToNull(returnRow.observacao),
        })
        .eq("id", returnRow.id);
      if (error) throw error;
      setReturnOpen(false);
      setReturnRow(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "Falha ao registrar retorno.");
    } finally {
      setLoading(false);
    }
  };

  /** ----------- AÇÃO: STATUS DO ITEM (tabela de origem) ----------- */
  const openStatusEditor = (r: Repair) => {
    setStatusRow(r);
    const cur = readStatusFromSnapshot(r) || "ATIVA";
    setStatusValue(cur);
    setStatusOpen(true);
  };

  const saveItemStatus = async () => {
    if (!statusRow) return;
    try {
      setLoading(true);
      setError(null);

      const idKey = guessIdKey(statusRow);
      const statusKey = guessStatusKey(statusRow);

      const matchVal = parseMatchVal(String(statusRow.item_id));
      const payload: any = { [statusKey]: statusValue };

      const { error } = await (supabase.from(statusRow.table_name) as any)
        .update(payload)
        .eq(idKey as any, matchVal as any);

      if (error) throw error;

      // atualiza snapshot do ticket para refletir o novo status
      await supabase
        .from("concerto")
        .update({
          item_snapshot: {
            ...(statusRow.item_snapshot || {}),
            [statusKey]: statusValue,
          },
        })
        .eq("id", statusRow.id);

      setStatusOpen(false);
      setStatusRow(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "Falha ao atualizar status do item.");
    } finally {
      setLoading(false);
    }
  };

  /** -------------------- helpers UI -------------------- */
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const handleSort = (column: keyof Repair) => {
    const next =
      sort.column === column
        ? ({ column, direction: sort.direction === "asc" ? "desc" : "asc" } as const)
        : ({ column, direction: "asc" } as const);
    setSort(next);
    updateURL({ sort: JSON.stringify(next), page: 1 });
  };
  const itemPath = (r: Repair) =>
    `/table/${encodeURIComponent(r.table_name)}/edit/${encodeURIComponent(String(r.item_id))}`;
  const itemAbsUrl = (r: Repair) => `${BASE_URL}${itemPath(r)}`;
  const rowsView = rows;
  const diasFora = (r: Repair) => {
    const a = new Date(r.enviado_em).getTime();
    const b = r.data_retorno ? new Date(r.data_retorno).getTime() : Date.now();
    const days = Math.floor((b - a) / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : 0;
  };
  const tabStats = useMemo(() => {
    return {
      abertos: rowsView.filter((r) => !r.data_retorno).length,
      retornados: rowsView.filter((r) => !!r.data_retorno).length,
    };
  }, [rowsView]);

  /** -------------------- UI -------------------- */
  return (
    <section className="container-max my-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Conserto</h1>
          {count > 0 && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
              {count.toLocaleString()} registro(s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              const val = e.target.value;
              setQ(val);
              updateURL({ q: val, page: 1 });
            }}
            placeholder="Buscar por ID, motivo, fornecedor, nota…"
            className="px-4 py-2 rounded-lg border border-gray-300 shadow-sm w-[320px]"
          />
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          >
            + Novo concerto
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="mb-3">
        <div className="inline-flex rounded-lg border bg-white shadow-sm overflow-hidden">
          {[
            { key: "abertos", label: `Em concertos (${tabStats.abertos})` },
            { key: "retornados", label: `Retornados (${tabStats.retornados})` },
            { key: "todos", label: "Todos" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`px-4 py-2 text-sm border-r last:border-r-0 ${
                currentTab === (t.key as any)
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "bg-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-[13px] border border-gray-200">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                {([
                  ["enviado_em", "Enviado em"],
                  ["table_name", "Tabela"],
                  ["item_id", "Item ID"],
                  ["motivo", "Motivo"],
                  ["fornecedor", "Fornecedor"],
                  ["nota", "Nota"],
                  ["data_saida", "Data de saída"], // <- usa data_saida
                  ["data_retorno", "Retornou em"],
                  ["custo", "Custo"],
                  ["", "Ações"],
                ] as [keyof Repair | "", string][]).map(([col, label]) => (
                  <th
                    key={label}
                    className={`text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 ${
                      col ? "cursor-pointer hover:bg-gray-100" : ""
                    }`}
                    onClick={() => col && handleSort(col as keyof Repair)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="uppercase tracking-wider text-[11px]">{label}</span>
                      {sort.column === col && (
                        <span aria-hidden>{sort.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsView.map((r) => (
                <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2 border-t border-gray-200" title={r.enviado_em}>
                    {fmtDateTime(r.enviado_em)}{" "}
                    {!r.data_retorno && (
                      <span className="ml-1 text-[11px] text-gray-500">({diasFora(r)}d)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-gray-200">{r.table_name}</td>
                  <td className="px-3 py-2 border-t border-gray-200">
                    <Link
                      to={`/table/${encodeURIComponent(r.table_name)}/edit/${encodeURIComponent(String(r.item_id))}`}
                      className="text-blue-700 underline"
                      title="Abrir item"
                    >
                      {r.item_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 border-t border-gray-200">
                    <span title={r.motivo || ""}>{truncate(r.motivo || "—", 64)}</span>
                  </td>
                  <td className="px-3 py-2 border-t border-gray-200">{r.fornecedor || "—"}</td>
                  <td className="px-3 py-2 border-t border-gray-200">{r.nota || "—"}</td>
                  <td className="px-3 py-2 border-t border-gray-200">
                    {r.data_saida ? fmtDate(r.data_saida) : "—"}
                  </td>
                  <td className="px-3 py-2 border-t border-gray-200">
                    {r.data_retorno ? fmtDateTime(r.data_retorno) : "—"}
                  </td>
                  <td className="px-3 py-2 border-t border-gray-200">
                    {r.custo != null ? fmtMoney(r.custo) : "—"}
                  </td>
                  <td className="px-3 py-2 border-t border-gray-200">
                    <div className="flex flex-wrap items-center gap-2">
                      {!r.data_retorno ? (
                        <button
                          onClick={() => openReturn(r)}
                          className="px-3 py-1.5 rounded-md border text-xs hover:bg-gray-50"
                          title="Marcar retorno"
                        >
                          ✔️ Retornou
                        </button>
                      ) : (
                        <button onClick={() => openEdit(r)} className="" title=""></button>
                      )}
                      <a href={`${BASE_URL}/table/${encodeURIComponent(r.table_name)}/edit/${encodeURIComponent(String(r.item_id))}`} className="" target="_" rel="n" title=""></a>
                      <button
                        onClick={() => openStatusEditor(r)}
                        className="px-3 py-1.5 rounded-md border text-xs hover:bg-gray-50"
                        title="Atualizar status do item na tabela de origem"
                      >
                        🛠️ Status do item
                      </button>
                      <button
                        onClick={() => confirmDelete(r)}
                        className="px-3 py-1.5 rounded-md border text-xs hover:bg-gray-50 text-rose-600"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      <strong>Status atual (item):</strong> {readStatusFromSnapshot(r) || "—"}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rowsView.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="border-t bg-gray-50 px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-700">
              <span>Mostrando </span>
              <span className="font-medium">
                {Math.min((page - 1) * pageSize + 1, count)}
              </span>
              <span> a </span>
              <span className="font-medium">
                {Math.min(page * pageSize, count)}
              </span>
              <span> de </span>
              <span className="font-medium">{count}</span>
              <span> registro(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => updateURL({ pageSize: Number(e.target.value), page: 1 })}
                className="px-2 py-1 text-sm border border-gray-300 rounded"
              >
                <option value={10}>10/página</option>
                <option value={20}>20/página</option>
                <option value={50}>50/página</option>
                <option value={100}>100/página</option>
              </select>

              <div className="flex gap-1">
                <button
                  onClick={() => updateURL({ page: 1 })}
                  disabled={page === 1 || loading}
                  className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  ««
                </button>
                <button
                  onClick={() => updateURL({ page: Math.max(1, page - 1) })}
                  disabled={page === 1 || loading}
                  className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  ‹
                </button>
                <span className="px-3 py-1 text-sm bg-blue-50 border border-blue-200 rounded">
                  {page} de {totalPages}
                </span>
                <button
                  onClick={() => updateURL({ page: Math.min(totalPages, page + 1) })}
                  disabled={page === totalPages || loading}
                  className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  ›
                </button>
                <button
                  onClick={() => updateURL({ page: totalPages })}
                  disabled={page === totalPages || loading}
                  className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  »»
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog Novo/Editar ticket */}
      {dialogOpen && editRow && (
        <Modal title={editRow.id ? "Editar concerto" : "Novo concerto"} onClose={() => setDialogOpen(false)}>
          <RepairForm
            value={editRow}
            onChange={setEditRow}
            onSubmit={saveEdit}
            submitting={loading}
          />
        </Modal>
      )}

      {/* Dialog Retorno */}
      {returnOpen && returnRow && (
        <Modal title="Registrar retorno" onClose={() => setReturnOpen(false)}>
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <div>
                <span className="font-medium">Item:</span>{" "}
                <Link to={itemPath(returnRow)} className="text-blue-700 underline">
                  {returnRow.table_name} / {returnRow.item_id}
                </Link>
              </div>
              <div className="text-gray-600">
                Enviado em {fmtDateTime(returnRow.enviado_em)} • {diasFora(returnRow)} dia(s) fora
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Custo (opcional)</label>
              <input
                type="number"
                step="0.01"
                value={returnRow.custo ?? ""}
                onChange={(e) =>
                  setReturnRow((s) => ({ ...(s as Repair), custo: e.target.value === "" ? null : Number(e.target.value) }))}
                className="w-full border rounded px-2 py-2"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Observação</label>
              <textarea
                value={returnRow.observacao ?? ""}
                onChange={(e) =>
                  setReturnRow((s) => ({ ...(s as Repair), observacao: e.target.value }))}
                className="w-full border rounded px-2 py-2"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setReturnOpen(false)} className="px-3 py-2 rounded border">
                Cancelar
              </button>
              <button
                onClick={saveReturn}
                disabled={loading}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Dialog Status do Item */}
      {statusOpen && statusRow && (
        <Modal title="Atualizar status do item" onClose={() => setStatusOpen(false)}>
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <div>
                <span className="font-medium">Tabela:</span> {statusRow.table_name}
              </div>
              <div>
                <span className="font-medium">Item ID:</span> {statusRow.item_id}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Status do item</label>
              <select
                className="w-full border rounded px-2 py-2"
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
              >
                <option value="ATIVA">ATIVA</option>
                <option value="INATIVO">INATIVO</option>
                <option value="EM_CONCERTO">EM_CONCERTO</option>
              </select>
              <div className="text-[11px] text-gray-500 mt-1">
                Atual (snapshot): <strong>{readStatusFromSnapshot(statusRow) || "—"}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setStatusOpen(false)} className="px-3 py-2 rounded border">
                Cancelar
              </button>
              <button
                onClick={saveItemStatus}
                disabled={loading}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

/** ====================== Formulário ====================== */
function RepairForm({
  value,
  onChange,
  onSubmit,
  submitting,
}: {
  value: Repair;
  onChange: (r: Repair) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const [paste, setPaste] = useState("");

  const tryParse = () => {
    if (!paste.trim()) return;
    const parsed = parseItemUrl(paste.trim());
    if (parsed) {
      onChange({ ...value, table_name: parsed.table, item_id: parsed.id });
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3 bg-gray-50">
        <label className="block text-xs text-gray-600 mb-1">Colar link do item (opcional)</label>
        <div className="flex gap-2">
          <input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="https://seuapp/table/<tabela>/edit/<id>"
            className="flex-1 border rounded px-2 py-2"
          />
          <button onClick={tryParse} className="px-3 py-2 rounded border hover:bg-white">
            Usar
          </button>
        </div>
        <div className="text-[11px] text-gray-500 mt-1">
          Aceita URL absoluta ou caminho relativo (com ou sem query/hash).
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Tabela</label>
          <input
            value={value.table_name}
            onChange={(e) => onChange({ ...value, table_name: e.target.value })}
            className="w-full border rounded px-2 py-2"
            placeholder="ex.: impressoras"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Item ID</label>
          <input
            value={value.item_id}
            onChange={(e) => onChange({ ...value, item_id: e.target.value })}
            className="w-full border rounded px-2 py-2"
            placeholder="ex.: 12345"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Motivo</label>
          <input
            value={value.motivo ?? ""}
            onChange={(e) => onChange({ ...value, motivo: e.target.value })}
            className="w-full border rounded px-2 py-2"
            placeholder="ex.: tela quebrada, diagnóstico, etc."
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Fornecedor</label>
          <input
            value={value.fornecedor ?? ""}
            onChange={(e) => onChange({ ...value, fornecedor: e.target.value })}
            className="w-full border rounded px-2 py-2"
            placeholder="ex.: Assistência X"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Nota</label>
          <input
            value={value.nota ?? ""}
            onChange={(e) => onChange({ ...value, nota: e.target.value })}
            className="w-full border rounded px-2 py-2"
            placeholder="Número da nota"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Enviado em</label>
          <input
            type="datetime-local"
            onChange={(e) => onChange({ ...value, enviado_em: e.target.value ? fromLocalInput(e.target.value) : new Date().toISOString() })}
            className="w-full border rounded px-2 py-2"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Data de saída</label>
          <input
            type="date"
            value={dateOnly(value.data_saida)}
            onChange={(e) => onChange({ ...value, data_saida: e.target.value || null })}
            className="w-full border rounded px-2 py-2"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Custo (opcional)</label>
          <input
            type="number"
            step="0.01"
            value={value.custo ?? ""}
            onChange={(e) => onChange({ ...value, custo: e.target.value === "" ? null : Number(e.target.value) })}
            className="w-full border rounded px-2 py-2"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Observação</label>
          <textarea
            value={value.observacao ?? ""}
            onChange={(e) => onChange({ ...value, observacao: e.target.value })}
            className="w-full border rounded px-2 py-2"
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onSubmit} disabled={submitting} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

/** ====================== Modal genérico ====================== */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative mx-auto my-10 w-[min(720px,95vw)] bg-white rounded-xl shadow-xl border p-4 z-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** ====================== Utils ====================== */
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function escapeComma(s: string) {
  return s.replace(/,/g, "\\,");
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("pt-BR") +
      " " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return iso!;
  }
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso!;
  }
}
function fmtMoney(v: number) {
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return String(v);
  }
}
function emptyToNull<T extends string | null | undefined>(s: T) {
  return (s && String(s).trim() !== "" ? s : null) as T;
}
function toNumberOrNull(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function dateOnlyIso(v?: string | null) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function dateOnly(v?: string | null) {
  if (!v) return "";
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : dateOnlyIso(v) || "";
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function fromLocalInput(s: string) {
  const d = new Date(s);
  return d.toISOString();
}
function parseItemUrl(urlOrPath: string): { table: string; id: string } | null {
  try {
    const url = urlOrPath.includes("://")
      ? new URL(urlOrPath)
      : new URL(urlOrPath, "http://dummy");
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "table");
    if (i >= 0 && parts[i + 1] && parts[i + 2] === "edit" && parts[i + 3]) {
      return { table: decodeURIComponent(parts[i + 1]), id: decodeURIComponent(parts[i + 3]) };
    }
    return null;
  } catch {
    return null;
  }
}
