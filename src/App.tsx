// src/App.tsx
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { Header } from "./components";
import ItemEdit from "./pages/ItemEdit";
import SetoresMapa from "./pages/SetoresMapa";
import { TableBrowser } from "./components";

// Página Explorar (recebe filtros da URL e passa pro TableBrowser)
function Explorar() {
  const [sp] = useSearchParams();

  const initialSearch = sp.get("q") ?? "";
  const initialTable = sp.get("table") ?? "";

  // até 2 filtros de coluna vindos da URL
  const getFilter = (idx: number) => {
    const col = sp.get(`f${idx}col`);
    const op = (sp.get(`f${idx}op`) as any) || "contains";
    const val = sp.get(`f${idx}val`);
    if (!col || !val) return null;
    return { column: col, operator: op, value: val } as const;
  };
  const initialFilters = [getFilter(1), getFilter(2)].filter(Boolean) as any;

  return (
    <section className="card p-4">
      <div className="min-h-[70vh]">
        <TableBrowser
          initialSearch={initialSearch}
          initialTable={initialTable}
          {...({ initialFilters } as any)}
        />
      </div>
    </section>
  );
}

// Página inicial simples, só com escolha de rota
function Home() {
  return (
    <section className="card p-8 text-center space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Gestão de Inventário
      </h1>
      <p className="text-gray-600">
        Escolha uma das opções abaixo para começar
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="/explorar"
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
        >
          🔎 Buscar no banco de dados
        </a>
        <a
          href="/setores"
          className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
        >
          🗺️ Visualizar mapa de setores
        </a>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen page">
        <Header />
        <main className="container-max py-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explorar" element={<Explorar />} />
            <Route path="/setores" element={<SetoresMapa />} />
            {/* Corrigir a rota para corresponder ao formato gerado pelo TableBrowser */}
            <Route path="/table/:table/edit/:id" element={<ItemEdit />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}