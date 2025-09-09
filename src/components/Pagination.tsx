interface Props {
  page: number
  pages: number
  onPage: (p:number)=>void
}
export default function Pagination({ page, pages, onPage }: Props) {
  if (pages <= 1) return null
  const prev = () => onPage(Math.max(1, page-1))
  const next = () => onPage(Math.min(pages, page+1))
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <button onClick={prev} disabled={page===1} className="px-3 py-1 rounded border bg-white disabled:opacity-50">Anterior</button>
      <span className="text-sm text-gray-600">Página {page} de {pages}</span>
      <button onClick={next} disabled={page===pages} className="px-3 py-1 rounded border bg-white disabled:opacity-50">Próxima</button>
    </div>
  )
}