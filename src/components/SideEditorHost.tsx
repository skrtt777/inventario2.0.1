import { useSideEditor } from "@/context/SideEditorContext";

export default function SideEditorHost() {
  const { isOpen, title, content, close } = useSideEditor();

  if (!isOpen) return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400">
      (sem editor aberto)
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold">{title || "Editor"}</h3>
        <button className="text-slate-500 hover:text-slate-800" onClick={close}>✕</button>
      </div>
      <div className="flex-1 overflow-auto">{content}</div>
    </div>
  );
}