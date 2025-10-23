export default function Header() {
  return (
    <header className="bg-white border-b">
      <div className="container-max py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-2xl font-semibold">Gestão de Inventário</h1>
          </div>
          <nav className="text-sm text-gray-500 desktop-only">
            <a href="/" className="hover:text-gray-700">Voltar para Home</a>
          </nav>
        </div>

        {/* Navegação rápida no mobile */}
        <nav className="mobile-only mt-3">
          <div className="grid grid-cols-4 gap-2 text-sm">
            <a href="/explorar" className="rounded-md border px-3 py-2 text-center bg-white hover:bg-gray-50">Explorar</a>
            <a href="/setores" className="rounded-md border px-3 py-2 text-center bg-white hover:bg-gray-50">Setores</a>
            <a href="/concerto" className="rounded-md border px-3 py-2 text-center bg-white hover:bg-gray-50">Concerto</a>
            <a href="/wifi" className="rounded-md border px-3 py-2 text-center bg-white hover:bg-gray-50">Wi‑Fi</a>
          </div>
        </nav>
      </div>
    </header>
  )
}
