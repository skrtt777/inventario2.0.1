import { TableBrowser } from "../components";

export default function Explorar() {
  return (
    <section className="card p-4">
      <div className="min-h-[70vh]">
        {/* sem busca e sem tabela pré-selecionada */}
        <TableBrowser initialSearch="" initialTable="" autopickFirstTable={false} />
      </div>
    </section>
  );
}