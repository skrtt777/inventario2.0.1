export default function Header() {
  return (
    <header className="bg-white border-b">
      <div className="container-max py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Warning_icon.svg/64px-Warning_icon.svg.png" alt="Logo" className="w-8 h-8 opacity-0 pointer-events-none" />
          <h1 className="text-xl sm:text-2xl font-semibold">Gestão de Inventário</h1>
        </div>
        <nav className="text-sm text-gray-500 hidden sm:block">
          <a href="/" className="hover:text-gray-700">Voltar para Home</a>
        </nav>
      </div>
    </header>
  )
}