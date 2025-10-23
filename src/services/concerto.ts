// src/services/concerto.ts
// Serviço para controlar abertura/fechamento de concerto no Supabase (tabela: concerto)

import { supabase } from "./supabase";

/** Linha na tabela `concerto` */
export type ConcertoRow = {
  id: string;
  table_name: string;
  item_id: string;
  motivo?: string | null;
  fornecedor?: string | null;
  nota?: string | null;
  enviado_em: string;            // ISO
  previsao_retorno?: string | null; // YYYY-MM-DD
  data_retorno?: string | null;   // ISO
  custo?: number | null;
  observacao?: string | null;
};

/** Tenta localizar uma linha pelo ID, testando várias colunas possíveis */
async function findRowByAnyId(table: string, rawId: string | number) {
  const id = String(rawId);
  const candidates = [
    "id", "ID", "Id", "iD",
    "uuid", "guid",
    "codigo", "código", "cod",
    "asset_id", "assetId",
    "id_inventario", "idinventario", "tombo", "patrimonio", "patrimônio",
  ];

  let lastErr: any = null;
  for (const idField of candidates) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(idField, id)
      .maybeSingle();

    if (data) return { row: data as Record<string, any>, idField };
    if (error) lastErr = error;
  }
  return { row: null as any, idField: null as any, error: lastErr };
}

/** Descobre o melhor campo de status dentro do row já carregado */
function pickStatusField(row: Record<string, any>): string | null {
  const keys = Object.keys(row || {});
  const lc = keys.map((k) => k.toLowerCase());
  const order = ["status", "situacao", "situação", "state", "ativo"];
  for (const name of order) {
    const idx = lc.indexOf(name);
    if (idx >= 0) return keys[idx];
  }
  // tentativa fuzzy
  const fj = lc.findIndex((k) => k.includes("status") || k.includes("situ") || k === "ativo");
  return fj >= 0 ? keys[fj] : null;
}

/** Atualiza o status do item de forma defensiva (string ou boolean) */
async function updateItemStatus(
  table: string,
  idField: string,
  idValue: string | number,
  row: Record<string, any>,
  statusTarget: string | boolean
) {
  const statusField = pickStatusField(row);
  if (!statusField) return { ok: false as const, reason: "no_status_field" as const };

  // se o campo é booleano → false/true; se string → usa string
  const current = row[statusField];
  let value: any = statusTarget;
  if (typeof current === "boolean") {
    value = typeof statusTarget === "boolean" ? statusTarget : statusTarget.toString().toLowerCase() !== "em_concerto";
  }

  const { error } = await supabase
    .from(table)
    .update({ [statusField]: value })
    .eq(idField, String(idValue));

  if (error) return { ok: false as const, reason: "update_failed" as const, error };
  return { ok: true as const, statusField };
}

/** Normaliza data-only YYYY-MM-DD */
function dateOnlyIso(v?: string | null) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Abre um concerto para um item (insere em `concerto` e marca status do item como "em_concerto"/false) */
export async function startConcerto(opts: {
  table: string;
  id: string | number;
  motivo?: string;
  fornecedor?: string;
  nota?: string;
  previsao_retorno?: string | null; // YYYY-MM-DD ou qualquer data parseável
  observacao?: string;
  /** valor de status no item enquanto em concerto; default "em_concerto" (string) */
  itemStatusWhileOut?: string | boolean;
}) {
  const {
    table,
    id,
    motivo,
    fornecedor,
    nota,
    previsao_retorno,
    observacao,
    itemStatusWhileOut = "em_concerto",
  } = opts;

  // 1) localizar o item e descobrir colunas
  const found = await findRowByAnyId(table, id);
  if (!found.row || !found.idField) {
    throw new Error(`Item não encontrado na tabela "${table}" com ID "${id}".`);
  }

  // 2) marcar status do item (defensivo)
  await updateItemStatus(table, found.idField, id, found.row, itemStatusWhileOut);

  // 3) inserir em `concerto`
  const payload = {
    table_name: table,
    item_id: String(id),
    motivo: motivo?.trim() || null,
    fornecedor: fornecedor?.trim() || null,
    nota: nota?.trim() || null,
    enviado_em: new Date().toISOString(),
    previsao_retorno: dateOnlyIso(previsao_retorno) /* date-only ou null */,
    data_retorno: null as string | null,
    custo: null as number | null,
    observacao: observacao?.trim() || null,
  };

  const { data, error } = await supabase.from("concerto").insert(payload).select().single();
  if (error) throw error;

  return {
    concerto: data as ConcertoRow,
    idField: found.idField as string,
    statusField: pickStatusField(found.row) || undefined,
  };
}

/** Fecha um concerto (marca retorno na `concerto`) e restaura status do item */
export async function closeConcerto(opts: {
  /** se não passar concertoId, procura o último aberto do item */
  concertoId?: string;
  table: string;
  id: string | number;
  custo?: number | null;
  observacao?: string;
  /** ISO datetime; default: agora */
  data_retorno?: string;
  /** status do item após retorno; default "ATIVA" (string) */
  itemStatusOnReturn?: string | boolean;
}) {
  const {
    concertoId,
    table,
    id,
    custo = null,
    observacao,
    data_retorno = new Date().toISOString(),
    itemStatusOnReturn = "ATIVA",
  } = opts;

  // 1) localizar o item
  const found = await findRowByAnyId(table, id);
  if (!found.row || !found.idField) {
    throw new Error(`Item não encontrado na tabela "${table}" com ID "${id}".`);
  }

  // 2) localizar o concerto alvo (id explícito ou último aberto)
  let targetId = concertoId || "";
  if (!targetId) {
    const { data, error } = await supabase
      .from("concerto")
      .select("*")
      .eq("table_name", table)
      .eq("item_id", String(id))
      .is("data_retorno", null)
      .order("enviado_em", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(`Nenhum concerto aberto encontrado para ${table}/${id}.`);
    }
    targetId = (data[0] as ConcertoRow).id;
  }

  // 3) atualizar concerto (retorno)
  const { data: updated, error: errUpd } = await supabase
    .from("concerto")
    .update({
      data_retorno,
      custo: custo === null ? null : Number(custo),
      observacao: observacao?.trim() || null,
    })
    .eq("id", targetId)
    .select()
    .single();

  if (errUpd) throw errUpd;

  // 4) restaurar status do item
  await updateItemStatus(table, found.idField, id, found.row, itemStatusOnReturn);

  return { concerto: updated as ConcertoRow, idField: found.idField as string, statusField: pickStatusField(found.row) || undefined };
}

/* ===================== DICAS DE USO =====================

import { startConcerto, closeConcerto } from "@/services/concerto";

// Abrir concerto a partir de um item (ex.: ao clicar "Abrir Concerto")
await startConcerto({
  table: "Impressoras",
  id: 1,
  motivo: "Sem imprimir",
  fornecedor: "Assistência X",
  nota: "NF-123",
  previsao_retorno: "2025-10-15",
  observacao: "Retirar no balcão",
  itemStatusWhileOut: "em_concerto", // ou false se seu campo for booleano
});

// Fechar concerto (ex.: botão "Retornou")
await closeConcerto({
  table: "Impressoras",
  id: 1,
  custo: 350.5,
  observacao: "Troca de rolete",
  itemStatusOnReturn: "ATIVA", // ou true se seu campo for booleano
});

========================================================= */
