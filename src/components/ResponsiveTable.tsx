import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import StatusBadge from './StatusBadge';
import type { Item } from '../types/item';
import { Link } from 'react-router-dom';

interface Props {
  items: Item[];
  tableName: string;               // nome da tabela (sem "public.")
  onEdit?: (item: Item) => void;   // opcional
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ResponsiveTable({
  items,
  tableName,
  onEdit,
  onMarkRead,
  onDelete,
}: Props) {
  const [qrItemId, setQrItemId] = useState<string | null>(null);

  const fmtDateTime = (v?: string | Date) => {
    if (!v) return '—';
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('pt-BR');
    } catch {
      return '—';
    }
  };

  // baixa o canvas do QR como PNG
  const downloadQR = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-canvas');
    if (!canvas || !qrItemId) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${qrItemId}.png`;
    a.click();
  };

  // NOVO: rota compatível com o TableBrowser (/table/:table/edit/:id)
  const editPath = (id: string | number) =>
    `/table/${encodeURIComponent(tableName)}/edit/${encodeURIComponent(String(id))}`;

  // Atalho para a tela de Concerto com item pré-selecionado
  const concertoPath = (id: string | number) =>
    `/concerto?table=${encodeURIComponent(tableName)}&id=${encodeURIComponent(String(id))}`;

  return (
    <div className="overflow-hidden bg-white rounded-xl shadow-sm border">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold text-gray-600">
              {[
                'id',
                'Nome',
                'Entidade',
                'Status',
                'Comentários',
                'Rede',
                'Localização',
                'Número de série',
                'Tipo',
                'Modelo',
                'Fabricante',
                'Última atualização',
                'ID_inventario',
                'Ativo',
                'Visto',
                'Ações',
              ].map((h) => (
                <th key={h} className="px-4 py-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it, idx) => (
              <tr key={it.id} className="text-sm">
                <td className="px-4 py-2">{idx + 1}</td>
                <td className="px-4 py-2">{it.nome}</td>
                <td className="px-4 py-2">{it.entidade}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={it.status} />
                </td>
                <td className="px-4 py-2">{it.comentarios}</td>
                <td className="px-4 py-2">{it.rede}</td>
                <td className="px-4 py-2">{it.localizacao}</td>
                <td className="px-4 py-2">{it.numeroSerie}</td>
                <td className="px-4 py-2">{it.tipo}</td>
                <td className="px-4 py-2">{it.modelo}</td>
                <td className="px-4 py-2">{it.fabricante}</td>
                <td className="px-4 py-2">{fmtDateTime(it.ultimaAtualizacao)}</td>
                <td className="px-4 py-2">{it.idInventario}</td>
                <td className="px-4 py-2">{it.ativo}</td>
                <td className="px-4 py-2">{it.visto ? '✔' : '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setQrItemId(String(it.id))}
                      className="px-2 py-1 border rounded text-xs bg-white hover:bg-gray-50"
                      title="Ver QR Code"
                    >
                      QR
                    </button>

                    <button
                      onClick={() => onMarkRead(it.id)}
                      className="px-2 py-1 border rounded text-xs bg-white hover:bg-gray-50"
                    >
                      Marcar como Lido
                    </button>

                    {/* Editar com a rota nova */}
                    <Link
                      to={editPath(it.id)}
                      className="px-2 py-1 border rounded text-xs bg-white hover:bg-gray-50"
                    >
                      Editar
                    </Link>

                    {/* Atalho para Concerto */}
                    <Link
                      to={concertoPath(it.id)}
                      className="px-2 py-1 border rounded text-xs bg-white hover:bg-gray-50"
                      title="Abrir tela de Concerto com este item"
                    >
                      Concerto
                    </Link>

                    <button
                      onClick={() => onDelete(it.id)}
                      className="px-2 py-1 border rounded text-xs text-red-600 bg-white hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
                </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-gray-600" colSpan={16}>
                  Nenhum registro
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-gray-200">
        {items.map((it, idx) => (
          <div key={it.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {idx + 1}. {it.nome} · <StatusBadge status={it.status} />
              </div>
              <div className="text-xs text-gray-500">{fmtDateTime(it.ultimaAtualizacao)}</div>
            </div>
            <div className="text-sm text-gray-700 mt-1">
              {it.localizacao} · {it.modelo} · {it.numeroSerie}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setQrItemId(String(it.id))}
                className="px-2 py-1 border rounded text-xs bg-white hover:bg-gray-50"
                title="Ver QR Code"
              >
                QR
              </button>

              <button onClick={() => onMarkRead(it.id)} className="px-2 py-1 border rounded text-xs">
                Marcar como Lido
              </button>

              <Link to={editPath(it.id)} className="px-2 py-1 border rounded text-xs">
                Editar
              </Link>

              <Link to={concertoPath(it.id)} className="px-2 py-1 border rounded text-xs">
                Concerto
              </Link>

              <button onClick={() => onDelete(it.id)} className="px-2 py-1 border rounded text-xs text-red-600">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal do QR */}
      {qrItemId && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setQrItemId(null)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">QR do Item</h3>
              <button onClick={() => setQrItemId(null)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col items-center gap-3">
              {(() => {
                const qrValue = `${window.location.origin}${editPath(qrItemId!)}`;
                return (
                  <>
                    <div className="p-2 bg-white border rounded-md">
                      <QRCodeCanvas id="qr-canvas" value={qrValue} size={200} includeMargin />
                    </div>
                    <div className="text-xs text-gray-600 break-all text-center max-w-[280px]">
                      {qrValue}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={downloadQR}
                        className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                      >
                        Baixar PNG
                      </button>
                      <button
                        onClick={() => setQrItemId(null)}
                        className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
                      >
                        Fechar
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
