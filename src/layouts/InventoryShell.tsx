import { ReactNode } from "react";
import { useSideEditor } from "@/context/SideEditorContext";

type Props = {
  left: ReactNode;      // navegação (menu)
  right?: ReactNode;    // painel de edição
  children: ReactNode;  // conteúdo principal (tabela, etc.)
};

export default function InventoryShell({ left, right, children }: Props) {
  const { isOpen } = useSideEditor(); // precisa existir no seu contexto
  const rightWidth = isOpen ? 420 : 0; // ajuste a largura do painel

  return (
    <div className="w-full h-[calc(100vh-64px)]">
      <div
        className="grid gap-4 h-full"
        style={{
          gridTemplateColumns: `280px minmax(0,1fr) ${rightWidth}px`,
        }}
      >
        {/* coluna esquerda */}
        <aside className="bg-white border rounded-xl shadow-sm overflow-auto">
          {left}
        </aside>

        {/* centro — ocupa tudo quando o editor está fechado */}
        <main className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {children}
        </main>

        {/* coluna direita (some quando width=0) */}
        <section
          className="bg-white border rounded-xl shadow-sm overflow-auto transition-[width,opacity] duration-200 ease-in-out"
          style={{ width: rightWidth, opacity: isOpen ? 1 : 0 }}
        >
          {isOpen ? right : null}
        </section>
      </div>
    </div>
  );
}
