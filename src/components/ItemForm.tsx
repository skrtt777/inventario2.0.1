import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface Props {
  onSubmit: (values: any) => void;
  onClose: () => void;
  initial?: Record<string, any>;
}

// Função para buscar valor em diferentes variações de campo
function getFieldValue(data: Record<string, any>, fieldNames: string[]): string {
  if (!data || typeof data !== 'object') return '';
  
  for (const name of fieldNames) {
    const value = data[name] || data[name.toUpperCase()] || data[name.toLowerCase()];
    if (value !== undefined && value !== null) {
      return String(value);
    }
  }
  return '';
}

export default function ItemForm({ onSubmit, onClose, initial = {} }: Props) {
  console.log('Dados iniciais recebidos no formulário:', initial);
  console.log('Campos disponíveis:', Object.keys(initial));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      nome: '',
      entidade: 'Arteb',
      status: 'ATIVA',
      comentarios: '-',
      rede: '-',
      localizacao: '',
      numeroSerie: '',
      tipo: '',
      modelo: '',
      fabricante: '',
      idInventario: '1',
      ativo: '-',
    },
  });

  // Atualizar o formulário quando os dados iniciais mudarem
  useEffect(() => {
    if (initial && Object.keys(initial).length > 0) {
      // Mapear os campos da tabela para o formulário de forma flexível
      const mappedValues = {
        nome: getFieldValue(initial, ['Nome', 'nome', 'NOME', 'name', 'NAME']),
        entidade: getFieldValue(initial, ['Entidade', 'entidade', 'ENTIDADE', 'entity']) || 'Arteb',
        status: getFieldValue(initial, ['Status', 'status', 'STATUS']) || 'ATIVA',
        comentarios: getFieldValue(initial, ['Comentarios', 'comentarios', 'COMENTARIOS', 'comments']) || '-',
        rede: getFieldValue(initial, ['Rede', 'rede', 'REDE', 'network']) || '-',
        localizacao: getFieldValue(initial, ['Localizacao', 'localizacao', 'LOCALIZACAO', 'location']),
        numeroSerie: getFieldValue(initial, ['Numero de serie', 'numeroSerie', 'NUMERO_DE_SERIE', 'numero_serie', 'serial']),
        tipo: getFieldValue(initial, ['Tipo', 'tipo', 'TIPO', 'type']),
        modelo: getFieldValue(initial, ['Modelo', 'modelo', 'MODELO', 'model']),
        fabricante: getFieldValue(initial, ['Fabricante', 'fabricante', 'FABRICANTE', 'manufacturer']),
        idInventario: getFieldValue(initial, ['ID_inventario', 'idInventario', 'ID_INVENTARIO', 'id_inventario']) || '1',
        ativo: getFieldValue(initial, ['Ativo', 'ativo', 'ATIVO', 'active']) || '-',
      };

      console.log('Valores mapeados para o formulário:', mappedValues);
      
      // Resetar o formulário com os novos valores
      reset(mappedValues);
    }
  }, [initial, reset]);

  const handleFormSubmit = (data: any) => {
    console.log('Dados do formulário sendo enviados:', data);
    
    // Criar objeto com os dados, mantendo os campos originais da tabela
    const updateData: Record<string, any> = {};
    
    // Mapear de volta para os campos originais da tabela
    Object.keys(initial).forEach(originalField => {
      const lowerField = originalField.toLowerCase();
      
      // Mapear os campos do formulário para os campos originais
      if (lowerField.includes('nome') || lowerField.includes('name')) {
        updateData[originalField] = data.nome;
      } else if (lowerField.includes('entidade')) {
        updateData[originalField] = data.entidade;
      } else if (lowerField.includes('status')) {
        updateData[originalField] = data.status;
      } else if (lowerField.includes('comentario')) {
        updateData[originalField] = data.comentarios;
      } else if (lowerField.includes('rede') || lowerField.includes('network')) {
        updateData[originalField] = data.rede;
      } else if (lowerField.includes('localizacao') || lowerField.includes('location')) {
        updateData[originalField] = data.localizacao;
      } else if (lowerField.includes('serie') || lowerField.includes('serial')) {
        updateData[originalField] = data.numeroSerie;
      } else if (lowerField.includes('tipo') || lowerField.includes('type')) {
        updateData[originalField] = data.tipo;
      } else if (lowerField.includes('modelo') || lowerField.includes('model')) {
        updateData[originalField] = data.modelo;
      } else if (lowerField.includes('fabricante') || lowerField.includes('manufacturer')) {
        updateData[originalField] = data.fabricante;
      } else if (lowerField.includes('inventario')) {
        updateData[originalField] = data.idInventario;
      } else if (lowerField.includes('ativo') || lowerField.includes('active')) {
        updateData[originalField] = data.ativo;
      } else {
        // Manter campos que não foram mapeados
        updateData[originalField] = (initial as any)[originalField];
      }
    });
    
    console.log('Dados finais para update:', updateData);
    onSubmit(updateData);
  };

  const inputCls =
    'w-full px-3 py-2 rounded-md border shadow-sm focus:outline-none focus:ring focus:ring-blue-200';

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-3">
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="bg-white w-full sm:max-w-2xl rounded-xl shadow-lg p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <h3 className="sm:col-span-2 text-lg font-semibold">Novo/Editar Item</h3>

        {/* Debug info - remover em produção */}
        <div className="sm:col-span-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <div>Campos da tabela: {Object.keys(initial).join(', ')}</div>
        </div>

        <div className="sm:col-span-2">
          <input 
            className={inputCls} 
            placeholder="Nome" 
            {...register('nome')} 
          />
        </div>

        <input className={inputCls} placeholder="Entidade" {...register('entidade')} />

        <select className={inputCls} {...register('status')}>
          <option value="ATIVA">ATIVA</option>
          <option value="INATIVO">INATIVO</option>
        </select>

        <input className={inputCls} placeholder="Comentários" {...register('comentarios')} />
        <input className={inputCls} placeholder="Rede" {...register('rede')} />
        <input className={inputCls} placeholder="Localização" {...register('localizacao')} />
        <input className={inputCls} placeholder="Número de série" {...register('numeroSerie')} />
        <input className={inputCls} placeholder="Tipo" {...register('tipo')} />
        <input className={inputCls} placeholder="Modelo" {...register('modelo')} />
        <input className={inputCls} placeholder="Fabricante" {...register('fabricante')} />
        <input className={inputCls} placeholder="ID inventário" {...register('idInventario')} />
        <input className={inputCls} placeholder="Ativo" {...register('ativo')} />

        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            ← Voltar sem salvar
          </button>
          <button 
            type="submit" 
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Salvar e voltar
          </button>
        </div>
      </form>
    </div>
  );
}