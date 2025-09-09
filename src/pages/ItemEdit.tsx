import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import ItemForm from '../components/ItemForm';
import type { Item } from '../types/item';

export default function ItemEdit() {
  // Usar useParams em vez de useSearchParams para pegar table e id da rota
  const { table, id } = useParams<{ table: string; id: string }>();
  
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!table || !id) {
      setError('Parâmetros table e id são obrigatórios na URL');
      setLoading(false);
      return;
    }

    loadItem();
  }, [table, id]);

  const loadItem = async () => {
    if (!table || !id) return;

    try {
      setLoading(true);
      setError(null);

      // Primeiro, vamos tentar diferentes campos de ID
      let query = supabase.from(table).select('*');
      
      // Tenta diferentes campos que podem ser o ID
      const possibleIdFields = ['id', 'ID', 'Id', 'iD'];
      let data = null;
      let error = null;

      for (const idField of possibleIdFields) {
        const result = await supabase
          .from(table)
          .select('*')
          .eq(idField, id)
          .maybeSingle();
        
        if (result.data) {
          data = result.data;
          break;
        }
        error = result.error;
      }

      if (!data) {
        throw new Error(`Item com ID ${id} não encontrado na tabela ${table}`);
      }

      // Debug: mostrar os dados recebidos
      console.log('Dados recebidos da tabela:', data);
      console.log('Campos disponíveis:', Object.keys(data));
      
      setItem(data as Item);
    } catch (e: any) {
      console.error('Erro ao carregar item:', e);
      setError(`Falha ao carregar item: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!table || !id) return;

    try {
      const { error } = await supabase
        .from(table)
        .update(values)
        .eq('id', id);

      if (error) throw error;

      alert('Item atualizado com sucesso!');
      // Voltar para a página anterior ou redirecionar
      window.history.back();
    } catch (e: any) {
      console.error('Erro ao atualizar item:', e);
      alert(`Falha ao atualizar item: ${e?.message || String(e)}`);
    }
  };

  const handleClose = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={handleClose}
          className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700"
        >
          Voltar
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="card p-6">
        <div className="text-gray-600 mb-4">Item não encontrado</div>
        <button
          onClick={handleClose}
          className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Editando item da tabela: {table}
          </h1>
          <p className="text-gray-600">ID: {id}</p>
        </div>
        <button
          onClick={handleClose}
          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          ← Voltar para lista
        </button>
      </div>

      <ItemForm
        initial={item}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    </div>
  );
}