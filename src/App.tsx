// src/App.tsx
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { Header } from "./components";
import ItemEdit from "@/pages/ItemEdit";
import SetoresMapa from "./pages/SetoresMapa";
import WifiMapa from "./pages/WifiMapa";
import ConcertoPage from "./pages/concerto";
import TableBrowser from "./components/TableBrowser";

// Página "Explorar": lê q/table da URL e repassa para o container
function Explorar() {
  const [sp] = useSearchParams();
  const initialSearch = sp.get("q") ?? "";
  const initialTable = sp.get("table") ?? "";
  return (
    <TableBrowser
      initialSearch={initialSearch}
      initialTable={initialTable}
      initialSearchTable={true}
      autopickFirstTable={false}
    />
  );
}

// Página inicial simples
function Home() {
  return (
    <section className="p-8 text-center space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Gestão de Inventário</h1>
      <p className="text-gray-600">Escolha uma das opções abaixo para começar</p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="/explorar"
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
        >
          Buscar no banco de dados
        </a>
        <a
          href="/setores"
          className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
        >
          Visualizar mapa de setores
        </a>
        <a
          href="/concerto"
          className="px-6 py-3 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700"
        >
          Controle de consertos
        </a>
        <a
          href="/wifi"
          className="px-6 py-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700"
        >
          Mapa Wi‑Fi
        </a>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Header />
        {/* Evita container duplicado: o TableBrowserLayout já tem container próprio */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-hidden p-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explorar" element={<Explorar />} />
            <Route path="/setores" element={<SetoresMapa />} />
          <Route path="/concerto" element={<ConcertoPage />} />
          <Route path="/wifi" element={<WifiMapa />} />
            {/* edição direta por tabela/id (usado em QR/links) */}
            <Route path="/table/:table/edit/:id" element={<ItemEdit />} />
            {/* opcional: 404 simples */}
            <Route path="*" element={<div className="p-8 text-center text-gray-600">Página não encontrada</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
