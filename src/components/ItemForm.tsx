import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface Props {
  onSubmit: (values: any) => void;
  onClose: () => void;
  initial?: Record<string, any>;
  // NOVO: quando clicar "Abrir Concerto" chamamos esse callback
  onGoConcerto?: (values: any) => void;
}

// Busca valor em diferentes variações de campo
function getFieldValue(data: Record<string, any>, fieldNames: string[]): string {
  if (!data || typeof data !== 'object') return '';
  for (const name of fieldNames) {
    const value = data[name] || data[name?.toUpperCase?.()] || data[name?.toLowerCase?.()];
    if (value !== undefined && value !== null) return String(value);
  }
  return '';
}

// Constrói objeto de update com base no "initial" (mantendo chaves originais)
// e sobrescrevendo a partir dos campos do formulário. Se forceStatus for passado,
// força o campo de status/situação para esse valor.
function buildUpdateData(
  initial: Record<string, any>,
  formData: any,
  forceStatus?: string
) {
  const updateData: Record<string, any> = {};

  Object.keys(initial).forEach((originalField) => {
    const lowerField = originalField.toLowerCase();

    if (lowerField.includes('nome') || lowerField.includes('name')) {
      updateData[originalField] = formData.nome;
    } else if (lowerField.includes('entidade')) {
      updateData[originalField] = formData.entidade;
    } else if (lowerField.includes('status') || lowerField.includes('situa')) {
      // status/situação
      updateData[originalField] = forceStatus ?? formData.status;
    } else if (lowerField.includes('comentario')) {
      updateData[originalField] = formData.comentarios;
    } else if (lowerField.includes('rede') || lowerField.includes('network')) {
      updateData[originalField] = formData.rede;
    } else if (lowerField.includes('localizacao') || lowerField.includes('location')) {
      updateData[originalField] = formData.localizacao;
    } else if (lowerField.includes('serie') || lowerField.includes('serial')) {
      updateData[originalField] = formData.numeroSerie;
    } else if (lowerField.includes('tipo') || lowerField.includes('type')) {
      updateData[originalField] = formData.tipo;
    } else if (lowerField.includes('modelo') || lowerField.includes('model')) {
      updateData[originalField] = formData.modelo;
    } else if (lowerField.includes('fabricante') || lowerField.includes('manufacturer')) {
      updateData[originalField] = formData.fabricante;
    } else if (lowerField.includes('inventario')) {
      updateData[originalField] = formData.idInventario;
    } else if (lowerField.includes('ativo') || lowerField.includes('active')) {
      updateData[originalField] = formData.ativo;
    } else {
      // Mantém campos não mapeados
      updateData[originalField] = (initial as any)[originalField];
    }
  });

  return updateData;
}

export default function ItemForm({ onSubmit, onClose, initial = {}, onGoConcerto }: Props) {
  const { register, handleSubmit, reset } = useForm({
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

  // Atualiza o form quando o "initial" muda
  useEffect(() => {
    if (initial && Object.keys(initial).length > 0) {
      const mapped = {
        nome: getFieldValue(initial, ['Nome', 'nome', 'NOME', 'name', 'NAME']),
        entidade: getFieldValue(initial, ['Entidade', 'entidade', 'ENTIDADE', 'entity']) || 'Arteb',
        status: getFieldValue(initial, ['Status', 'status', 'STATUS', 'Situação', 'situacao', 'SITUACAO']) || 'ATIVA',
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
      reset(mapped);
    }
  }, [initial, reset]);

  // Salvar “normal”
  const onSave = (data: any) => {
    const updateData = buildUpdateData(initial, data);
    onSubmit(updateData);
  };

  // Salvar e ir para Concerto (força status)
  const onSaveAndGoConcerto = (data: any) => {
    const updateData = buildUpdateData(initial, data, 'EM_CONCERTO');
    if (onGoConcerto) onGoConcerto(updateData);
    else onSubmit(updateData);
  };

  const inputCls =
    'w-full px-3 py-2 rounded-md border shadow-sm focus:outline-none focus:ring focus:ring-blue-200';

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-3">
      <form
        onSubmit={handleSubmit(onSave)}
        className="bg-white w-full sm:max-w-2xl rounded-xl shadow-lg p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <h3 className="sm:col-span-2 text-lg font-semibold">Novo/Editar Item</h3>

        {/* (opcional) debug dos campos disponíveis */}
        <div className="sm:col-span-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <div>Campos da tabela: {Object.keys(initial).join(', ')}</div>
        </div>

        <div className="sm:col-span-2">
          <input className={inputCls} placeholder="Nome" {...register('nome')} />
        </div>

        <input className={inputCls} placeholder="Entidade" {...register('entidade')} />

        <select className={inputCls} {...register('status')}>
          <option value="ATIVA">ATIVA</option>
          <option value="INATIVO">INATIVO</option>
          <option value="EM_CONCERTO">EM_CONCERTO</option>
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

        <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            ← Voltar sem salvar
          </button>

          {/* Botão que salva com EM_CONCERTO e vai para a tela de concerto */}
          <button
            type="button"
            onClick={handleSubmit(onSaveAndGoConcerto)}
            className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700"
            title="Marca como EM_CONCERTO e abre a tela de Concerto"
          >
            Abrir Concerto
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
