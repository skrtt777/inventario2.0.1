export type Status = 'ATIVA' | 'INATIVO';
export interface Item {
  id: string;
  nome: string;
  entidade: string;
  status: Status;
  comentarios: string;
  rede: string;
  localizacao: string;
  numeroSerie: string;
  tipo: string;
  modelo: string;
  fabricante: string;
  ultimaAtualizacao: string; // ISO
  idInventario: string;
  ativo: string;
  visto: boolean;
}