import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
          Inventário • Home
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Escolha como deseja navegar: busca direta no banco ou pelo mapa de setores.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/explorar")}
            className="w-full text-left rounded-2xl border p-4 shadow-sm hover:bg-gray-50"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl leading-none">🔎</div>
              <div>
                <div className="font-semibold text-gray-900">Buscar no banco de dados</div>
                <div className="text-sm text-gray-600 mt-0.5">
                  Abra o explorador e escolha a tabela que deseja ver.
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/setores")}
            className="w-full text-left rounded-2xl border p-4 shadow-sm hover:bg-gray-50"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl leading-none">🗺️</div>
              <div>
                <div className="font-semibold text-gray-900">Mapa de setores</div>
                <div className="text-sm text-gray-600 mt-0.5">
                  Clique no setor para ver itens e categorias.
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
