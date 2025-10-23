import { useRef, useState } from 'react';
import { QRCode } from 'qrcode.react';
import { supabase } from '../services/supabase';

type Props = {
  id: string | number;          // id do item
  label?: string;               // opcional: rótulo abaixo do QR
  asUrl?: boolean;              // se true, gera URL /item/:id; senão o próprio id
  storageBucket?: string;       // opcional: bucket do storage para salvar a imagem
};

export default function QRBadge({ id, label, asUrl = true, storageBucket }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  // valor codificado no QR
  const value = asUrl
    ? `${window.location.origin}/item/${id}`
    : String(id);

  // baixa o PNG
  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${id}.png`;
    a.click();
  };

  // salva no Supabase Storage (opcional)
  const handleSaveToStorage = async () => {
    if (!storageBucket) return;
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      // transformar em blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const path = `qrcodes/qr-${id}.png`;
      const { error } = await supabase.storage.from(storageBucket).upload(path, blob, {
        upsert: true,
        contentType: 'image/png',
      });
      if (error) throw error;
      alert('QR salvo no Storage com sucesso!');
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Falha ao salvar no Storage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={canvasRef} className="p-2 bg-white rounded-md border">
        <QRCode value={value} size={180} includeMargin />
      </div>
      {label && <div className="text-xs text-gray-600">{label}</div>}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="px-3 py-1 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          Baixar PNG
        </button>
        {storageBucket && (
          <button
            onClick={handleSaveToStorage}
            className="px-3 py-1 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar no Storage'}
          </button>
        )}
      </div>
    </div>
  );
}
