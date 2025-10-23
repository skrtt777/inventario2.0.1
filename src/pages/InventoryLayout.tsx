import { Link, Outlet, useLocation } from "react-router-dom";
import InventoryShell from "@/layouts/InventoryShell";
import SideEditorHost from "@/components/SideEditorHost";

export default function InventoryLayout() {
  const { pathname } = useLocation();

  return (
    // sem "container-max": deixa ocupar toda a largura
    <div className="w-full px-4 py-4">
      <InventoryShell
        left={<LeftNav activePath={pathname} />}
        right={<SideEditorHost />}
      >
        {/* Conteúdo central (rotas filhas) */}
        <div className="h-full w-full flex flex-col">
          <Outlet />
        </div>
      </InventoryShell>
    </div>
  );
}

function LeftNav({ activePath }: { activePath: string }) {
  const item =
    "block px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition";
  const active =
    "bg-blue-50 text-blue-700 border border-blue-100 font-medium";

  return (
    <nav className="p-3">
      <div className="text-xs uppercase text-slate-500 mb-2">Navegação</div>

      <Link
        to="/explorar"
        className={`${item} ${activePath.startsWith("/explorar") ? active : "text-slate-700"}`}
      >
        Explorar tabelas
      </Link>

      <Link
        to="/concerto"
        className={`${item} ${activePath.startsWith("/concerto") ? active : "text-slate-700"}`}
      >
        Conserto
      </Link>

      <div className="mt-6 text-[11px] text-slate-400">Inventário • v1.0</div>
    </nav>
  );
}
