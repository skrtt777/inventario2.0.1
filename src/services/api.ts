import type { Item } from '../../src/types/item'
import { supabase } from './supabase'

const toDb = (x: Partial<Item>) => ({
  nome: x.nome,
  entidade: x.entidade,
  status: x.status,
  comentarios: x.comentarios ?? '-',
  rede: x.rede ?? '-',
  localizacao: x.localizacao,
  numero_serie: x.numeroSerie,
  tipo: x.tipo,
  modelo: x.modelo,
  fabricante: x.fabricante,
  id_inventario: x.idInventario ?? '1',
  ativo: x.ativo ?? '-',
  visto: x.visto ?? false,
})

const fromDb = (row: any): Item => ({
  id: row.id,
  nome: row.nome,
  entidade: row.entidade,
  status: row.status,
  comentarios: row.comentarios,
  rede: row.rede,
  localizacao: row.localizacao,
  numeroSerie: row.numero_serie,
  tipo: row.tipo,
  modelo: row.modelo,
  fabricante: row.fabricante,
  ultimaAtualizacao: row.ultima_atualizacao,
  idInventario: row.id_inventario,
  ativo: row.ativo,
  visto: !!row.visto,
})

export async function listItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('ultima_atualizacao', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromDb)
}

export async function addItem(payload: Omit<Item,'id'|'ultimaAtualizacao'|'visto'>) {
  const { error } = await supabase.from('items').insert([toDb(payload)])
  if (error) throw error
}

export async function updateItem(id: string, changes: Partial<Item>) {
  const dbChanges = toDb(changes)
  const { error } = await supabase.from('items').update(dbChanges).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

export async function markAsRead(id: string, visto = true) {
  const { error } = await supabase.from('items').update({ visto }).eq('id', id)
  if (error) throw error
}
