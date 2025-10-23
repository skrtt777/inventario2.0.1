import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Row = Record<string, any>;
type ScalarType = "text" | "number" | "boolean" | "date" | "unknown";

type ColumnMeta = { name: string; type: ScalarType };
type TableMeta = { schemaname: string; tablename: string };
type Draft = { column: string; op: string; value?: string; value2?: string };

type ViewMode = "table" | "cards";

interface TableBrowserLayoutProps {
  tables: TableMeta[];
  table: string;
  onChangeTable: (table: string) => void;
  effectiveCount: number;
  globalSearch: string;
  onChangeSearch: (value: string) => void;
  onApplyServerFilter: () => void;
  onRunDiagnostics: () => void;
  columnMeta: ColumnMeta[];
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  getTypeFor: (column: string) => ScalarType;
  getOpsFor: (type: ScalarType) => { value: string; label: string }[];
  onClearFilter: () => void;
  appliedCount: number;
  selectedCount: number;
  onClearSelection: () => void;
  error: string | null;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  availableColumns: string[];
  columns: string[];
  ACTIONS_COL_KEY: string;
  visibleRows: Row[];
  selectedRows: Set<number>;
  onToggleAll: () => void;
  onToggleRow: (index: number) => void;
  onSort: (column: string) => void;
  getEditPath: (row: Row) => string | null;
  onDesigner: (row: Row) => void;
  onPrint: (row: Row) => void;
  onSendToRepair: (row: Row) => void;
  getRowId: (row: Row) => string | number | null;
  stringifyCell: (value: unknown) => string;
  formatCell: (value: unknown) => string;
  canExport: boolean;
  onExportCSV: () => void;
  onExportJSON: () => void;
  canCreate: boolean;
  onCreate?: () => void;
  page: number;
  pageSize: number;
  totalPages: number;
  onChangePageSize: (size: number) => void;
  gotoFirst: () => void;
  gotoPrev: () => void;
  gotoNext: () => void;
  gotoLast: () => void;
  rawCount: number;
  loading: boolean;
}

const makeAnchorId = (value: string | number) =>
  `r-${String(value).trim().replace(/[^A-Za-z0-9_.:-]/g, "-")}`;

const noop = () => {};

const normalizeKey = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const findMatchingKey = (row: Row, candidates: string[]): string | null => {
  if (!row) return null;
  const keys = Object.keys(row);
  if (keys.length === 0) return null;
  const map = new Map<string, string>();
  for (const key of keys) {
    map.set(normalizeKey(key), key);
  }
  for (const candidate of candidates) {
    const hit = map.get(normalizeKey(candidate));
    if (hit) return hit;
  }
  return null;
};

const valueFor = (row: Row, candidates: string[]): unknown => {
  const key = findMatchingKey(row, candidates);
  if (!key) return undefined;
  const value = (row as Row)[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const NAME_CANDIDATES = ["nome", "name", "descricao", "titulo", "produto"];
const LOCAL_CANDIDATES = ["localizacao", "local", "setor", "sala", "ambiente"];
const STATUS_CANDIDATES = ["status", "situacao", "state"];
const REDE_CANDIDATES = ["rede", "network", "ssid", "ip", "endereco_ip"];
const MODEL_CANDIDATES = ["modelo", "model", "produto", "titulo", "nome"];
const DIRECT_IMAGE_FIELDS = [
  "foto",
  "imagem",
  "image",
  "photo",
  "thumbnail",
  "thumb",
  "url_foto",
  "url_imagem",
  "url_imagen",
];
const MODEL_IMAGE_MAP: Record<string, string> = {
  zd220: "zd220.webp",
  zd230: "zd230.webp",
  gx420t: "GX420t.webp",
  gt800: "GT800.webp",
  iafox: "IAFOX.webp",
};
const IMAGE_EXTENSIONS = ["webp", "png", "jpg", "jpeg"];
const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
const CARD_FIELD_SPECS = [
  { label: "Localizacao", candidates: LOCAL_CANDIDATES },
  { label: "Status", candidates: STATUS_CANDIDATES },
  { label: "Rede", candidates: REDE_CANDIDATES },
];

export default function TableBrowserLayout({
  tables,
  table,
  onChangeTable,
  effectiveCount,
  globalSearch,
  onChangeSearch,
  onApplyServerFilter,
  onRunDiagnostics,
  columnMeta,
  draft,
  setDraft,
  getTypeFor,
  getOpsFor,
  onClearFilter,
  appliedCount,
  selectedCount,
  onClearSelection,
  error,
  viewMode,
  onChangeViewMode,
  availableColumns,
  columns,
  ACTIONS_COL_KEY,
  visibleRows,
  selectedRows,
  onToggleAll,
  onToggleRow,
  onSort,
  getEditPath,
  onDesigner,
  onPrint,
  onSendToRepair,
  getRowId,
  stringifyCell,
  formatCell,
  canExport,
  onExportCSV,
  onExportJSON,
  canCreate,
  onCreate = noop,
  page,
  pageSize,
  totalPages,
  onChangePageSize,
  gotoFirst,
  gotoPrev,
  gotoNext,
  gotoLast,
  rawCount,
  loading,
}: TableBrowserLayoutProps) {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!exportRef.current?.contains(target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  const typeForDraft = getTypeFor(draft.column || "");
  const availableOps = useMemo(() => getOpsFor(typeForDraft), [getOpsFor, typeForDraft]);
  const resolvedOp = useMemo(() => {
    if (availableOps.length === 0) return draft.op;
    if (availableOps.some((op) => op.value === draft.op)) return draft.op;
    return availableOps[0]?.value ?? draft.op;
  }, [availableOps, draft.op]);

  useEffect(() => {
    if (!draft.column) return;
    if (resolvedOp && resolvedOp !== draft.op) {
      setDraft({ op: resolvedOp });
    }
  }, [resolvedOp, draft.column, draft.op, setDraft]);

  const hasColumn = Boolean(draft.column);
  const needsValue =
    hasColumn &&
    resolvedOp &&
    !["null", "not_null", "is_true", "is_false"].includes(resolvedOp);
  const needsSecondValue = hasColumn && resolvedOp === "between";
  const inputType =
    typeForDraft === "number" ? "number" : typeForDraft === "date" ? "date" : "text";

  const tableOptions = useMemo(
    () =>
      tables
        .slice()
        .sort((a, b) => a.tablename.localeCompare(b.tablename))
        .map((t) => t.tablename),
    [tables]
  );

  const primaryColumns = useMemo(
    () => columns.filter((c) => c !== ACTIONS_COL_KEY),
    [columns, ACTIONS_COL_KEY]
  );

  const getImageForRow = (row: Row): string | null => {
    const seen = new Set<string>();
    const push = (src: string | null | undefined) => {
      if (!src) return;
      const trimmed = src.trim();
      if (!trimmed) return;
      if (seen.has(trimmed)) return;
      seen.add(trimmed);
    };

    const direct = valueFor(row, DIRECT_IMAGE_FIELDS);
    if (typeof direct === "string") {
      let url = direct.trim();
      if (url && !/^https?:\/\//i.test(url) && !url.startsWith("/")) {
        url = `/images/models/${url}`;
      }
      push(url);
    }

    const modelRaw = valueFor(row, MODEL_CANDIDATES);
    if (typeof modelRaw === "string") {
      const model = modelRaw.trim();
      if (model) {
        const mapHit = MODEL_IMAGE_MAP[normalizeKey(model)];
        if (mapHit) push(`/images/models/${mapHit}`);

        const cleanModel = model.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const slug = slugify(cleanModel);
        if (slug) {
          IMAGE_EXTENSIONS.forEach((ext) => push(`/images/models/${slug}.${ext}`));
          const noDash = slug.replace(/-/g, "");
          if (noDash && noDash !== slug) {
            IMAGE_EXTENSIONS.forEach((ext) => push(`/images/models/${noDash}.${ext}`));
          }
        }

        const upper = cleanModel.replace(/[^A-Za-z0-9]/g, "");
        if (upper) {
          const mappedUpper = MODEL_IMAGE_MAP[upper.toLowerCase()];
          if (mappedUpper) push(`/images/models/${mappedUpper}`);
          IMAGE_EXTENSIONS.forEach((ext) => push(`/images/models/${upper}.${ext}`));
        }
      }
    }

    if (table) {
      const tableSlug = slugify(table);
      if (tableSlug) {
        IMAGE_EXTENSIONS.forEach((ext) =>
          push(`/images/tables/${tableSlug}.${ext}`)
        );
        const noDash = tableSlug.replace(/-/g, "");
        if (noDash && noDash !== tableSlug) {
          IMAGE_EXTENSIONS.forEach((ext) =>
            push(`/images/tables/${noDash}.${ext}`)
          );
        }
      }
    }

    if (seen.size === 0) return null;
    return Array.from(seen)[0];
  };

  const renderActions = (row: Row, editPath: string | null) => {
    const disabled = !editPath;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSendToRepair(row)}
          disabled={disabled}
          className={`px-2 py-1 rounded border text-xs ${
            disabled ? "opacity-50 cursor-not-allowed" : "border-amber-600 text-amber-700 hover:bg-amber-50"
          }`}
        >
          Concerto
        </button>
        {editPath ? (
          <Link
            to={editPath}
            className="px-2 py-1 rounded border text-xs border-blue-600 text-blue-700 hover:bg-blue-50"
          >
            Editar
          </Link>
        ) : (
          <span className="px-2 py-1 text-xs text-slate-400">Editar</span>
        )}
        <button
          type="button"
          onClick={() => onDesigner(row)}
          disabled={disabled}
          className={`px-2 py-1 rounded border text-xs ${
            disabled ? "opacity-50 cursor-not-allowed" : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          Desing
        </button>
        <button
          type="button"
          onClick={() => onPrint(row)}
          disabled={disabled}
          className={`hidden px-2 py-1 rounded border text-xs ${
            disabled ? "opacity-50 cursor-not-allowed" : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          Imprimir
        </button>
      </div>
    );
  };

  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-slate-200 rounded-lg overflow-hidden text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="w-10 px-3 py-2 text-left">
              <input
                type="checkbox"
                checked={selectedRows.size > 0 && selectedRows.size === visibleRows.length}
                onChange={onToggleAll}
              />
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-semibold uppercase text-xs tracking-wide cursor-pointer select-none"
                onClick={() => col !== ACTIONS_COL_KEY && onSort(col)}
              >
                {col === ACTIONS_COL_KEY ? "ACOES" : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, idx) => {
            const checked = selectedRows.has(idx);
            const editPath = getEditPath(row);
            const anchorId = (() => {
              const idVal = getRowId(row);
              if (idVal === null || idVal === undefined || idVal === "") return undefined;
              return makeAnchorId(idVal);
            })();
            return (
              <tr
                key={anchorId ?? idx}
                id={anchorId}
                className={`border-t border-slate-200 ${checked ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
              >
                <td className="px-3 py-2 align-middle">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleRow(idx)}
                  />
                </td>
                {columns.map((col) => {
                  if (col === ACTIONS_COL_KEY) {
                    return (
                      <td key={col} className="px-3 py-2 align-middle">
                        {renderActions(row, editPath)}
                      </td>
                    );
                  }
                  const value = (row as Row)[col];
                  return (
                    <td key={col} className="px-3 py-2 align-top" title={stringifyCell(value)}>
                      <div className="whitespace-pre-wrap break-words">
                        {formatCell(value)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {!loading && visibleRows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-500">
                Nenhum registro encontrado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const CARD_ACCENTS = ["bg-emerald-50 border-emerald-200", "bg-blue-50 border-blue-200", "bg-amber-50 border-amber-200"];
  const renderCards = () => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visibleRows.map((row, idx) => {
        const editPath = getEditPath(row);
        const rowId = getRowId(row);
        const anchorId = rowId === null || rowId === undefined ? undefined : makeAnchorId(rowId);
        const nameValue = valueFor(row, NAME_CANDIDATES);
        const titleValue = (() => {
          if (nameValue !== undefined) return formatCell(nameValue);
          for (const col of primaryColumns) {
            if (!col) continue;
            const value = (row as Row)[col];
            if (value !== null && value !== undefined) {
              const str = typeof value === "string" ? value.trim() : String(value);
              if (str !== "") return formatCell(value);
            }
          }
          if (rowId !== null && rowId !== undefined && String(rowId).trim() !== "") {
            return formatCell(rowId);
          }
          return "Item";
        })();
        const detailItems = CARD_FIELD_SPECS.map((spec) => {
          const value = valueFor(row, spec.candidates);
          if (value === undefined) return null;
          return { label: spec.label, value: formatCell(value) };
        }).filter(
          (item): item is { label: string; value: string } => item !== null
        );
        const imageSrc = getImageForRow(row);
        const accent = CARD_ACCENTS[idx % CARD_ACCENTS.length];
        return (
          <article
            key={anchorId ?? idx}
            id={anchorId}
            className={`group rounded-lg border bg-white shadow-sm p-3 flex flex-col gap-3 transition transform hover:-translate-y-1 hover:shadow-lg hover:border-blue-300 ${accent}`}
          >
            <div className="flex items-start gap-3">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {imageSrc ? (
                  <>
                    <img
                      src={imageSrc}
                      alt={`Foto do item ${titleValue}`}
                      className="h-full w-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                      onError={(event) => {
                        event.currentTarget.remove();
                        const fallback = event.currentTarget.parentElement?.querySelector<HTMLElement>("[data-image-fallback]");
                        if (fallback) fallback.classList.remove("hidden");
                      }}
                    />
                    <div
                      data-image-fallback
                      className="hidden absolute inset-0 flex items-center justify-center text-[10px] font-medium uppercase tracking-wide text-slate-400"
                    >
                      Sem imagem
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Sem imagem
                  </div>
                )}
              </div>
              <div className="flex flex-1 items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">
                    {titleValue}
                  </h3>
                  {rowId != null && (
                    <p className="text-xs text-slate-500">ID: {formatCell(rowId)}</p>
                  )}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-xs text-slate-600">
              {detailItems.map((item) => (
                <div key={item.label}>
                  <dt className="font-semibold uppercase tracking-wide text-[11px] text-slate-500">
                    {item.label}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto">{renderActions(row, editPath)}</div>
          </article>
        );
      })}
      {!loading && visibleRows.length === 0 && (
        <div className="px-4 py-12 text-center text-slate-500 rounded border border-slate-200 bg-white">
          Nenhum registro encontrado
        </div>
      )}
    </div>
  );

  return (
    <section className="flex flex-col h-full gap-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              Tabela selecionada
            </span>
            <div className="flex items-center gap-2">
              <select
                value={table}
                onChange={(e) => onChangeTable(e.target.value)}
                className="min-w-[200px] rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">-- escolha a tabela --</option>
                {tableOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                {effectiveCount.toLocaleString()} itens visiveis
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeViewMode("table")}
              className={`px-3 py-1.5 text-sm rounded border ${
                viewMode === "table"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              Tabela
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode("cards")}
              className={`px-3 py-1.5 text-sm rounded border ${
                viewMode === "cards"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              Cartoes
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={globalSearch}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder="Pesquisar na pagina..."
            className="w-[320px] max-w-full rounded border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={onApplyServerFilter}
            disabled={loading || !table}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Carregando..." : "Aplicar filtro"}
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={onCreate}
              disabled={loading || !table}
              className="px-3 py-2 rounded border-2 border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50 text-sm"
            >
              + Novo
            </button>
          )}
          <button
            type="button"
            onClick={onRunDiagnostics}
            className="px-3 py-2 rounded border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
          >
            Ping
          </button>
          <div ref={exportRef} className="relative">
            <button
              type="button"
              onClick={() => canExport && setExportOpen((open) => !open)}
              disabled={!canExport}
              className="px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Exportar v
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    onExportCSV();
                    setExportOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportJSON();
                    setExportOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                >
                  JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hidden">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto_auto] items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500">Coluna</span>
            <select
              value={draft.column}
              onChange={(e) => {
                const nextColumn = e.target.value;
                if (!nextColumn) {
                  setDraft({ column: "", op: "", value: "", value2: "" });
                  return;
                }
                const nextType = getTypeFor(nextColumn);
                const nextOps = getOpsFor(nextType);
                setDraft({
                  column: nextColumn,
                  op: nextOps[0]?.value ?? "",
                  value: "",
                  value2: "",
                });
              }}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">-- coluna --</option>
              {columnMeta
                .filter((meta) => meta.name !== ACTIONS_COL_KEY)
                .map((meta) => (
                  <option key={meta.name} value={meta.name}>
                    {meta.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500">Operador</span>
            <select
              value={resolvedOp}
              onChange={(e) => setDraft({ op: e.target.value })}
              className="rounded border border-slate-300 px-3 py-2"
            >
              {availableOps.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </label>

  {/* Values */}
          <div className="flex flex-col gap-2">
            {needsValue && (
              <input
                type={inputType}
                value={draft.value ?? ""}
                onChange={(e) => setDraft({ value: e.target.value })}
                placeholder={resolvedOp === "in" ? "valor1, valor2" : "Valor..."}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
            )}
            {needsSecondValue && (
              <input
                type={inputType}
                value={draft.value2 ?? ""}
                onChange={(e) => setDraft({ value2: e.target.value })}
                placeholder="Valor final..."
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          <button
            type="button"
            onClick={onApplyServerFilter}
            disabled={loading || !table}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Carregando..." : "Aplicar"}
          </button>
          <button
            type="button"
            onClick={onClearFilter}
            disabled={loading}
            className="px-4 py-2 rounded border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Limpar
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            {appliedCount} condicao{appliedCount === 1 ? "" : "es"} aplicada{appliedCount === 1 ? "" : "s"}
          </span>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="px-3 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs"
            >
              Limpar selecao ({selectedCount})
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </section>

      <main className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm text-slate-600 flex-wrap gap-2">
          <div>
            Itens visiveis:{" "}
            <strong>{visibleRows.length.toLocaleString()}</strong>
            {globalSearch && (
              <span className="text-blue-600">
                {" "}
                (filtrados de {rawCount.toLocaleString()})
              </span>
            )}
          </div>
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {availableColumns.length} colunas disponiveis
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          {viewMode === "cards" ? renderCards() : renderTable()}
        </div>
      </main>

      <footer className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <div>
          Mostrando{" "}
          <span className="font-semibold">
            {Math.min((page - 1) * pageSize + 1, effectiveCount)}
          </span>{" "}
          a{" "}
          <span className="font-semibold">
            {Math.min(page * pageSize, effectiveCount)}
          </span>{" "}
          de{" "}
          <span className="font-semibold">{effectiveCount.toLocaleString()}</span> registros
        </div>
        <div className="flex items-center gap-3">
          <select
            value={pageSize}
            onChange={(e) => onChangePageSize(Number(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1"
          >
            {[10, 20, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size}/pagina
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={gotoFirst}
              disabled={page === 1 || loading}
              className="h-8 w-8 rounded border border-slate-300 text-sm disabled:opacity-50"
            >
              {"<<"}
            </button>
            <button
              type="button"
              onClick={gotoPrev}
              disabled={page === 1 || loading}
              className="h-8 w-8 rounded border border-slate-300 text-sm disabled:opacity-50"
            >
              {"<"}
            </button>
            <span className="px-3 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-sm">
              {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={gotoNext}
              disabled={page === totalPages || loading}
              className="h-8 w-8 rounded border border-slate-300 text-sm disabled:opacity-50"
            >
              {">"}
            </button>
            <button
              type="button"
              onClick={gotoLast}
              disabled={page === totalPages || loading}
              className="h-8 w-8 rounded border border-slate-300 text-sm disabled:opacity-50"
            >
              {">>"}
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}
