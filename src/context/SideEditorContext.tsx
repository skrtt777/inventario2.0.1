import React, { createContext, useContext, useMemo, useState } from "react";

type Ctx = {
  open: (content: React.ReactNode, title?: string) => void;
  close: () => void;
  setTitle: (t: string) => void;
  isOpen: boolean;
  title: string;
  content: React.ReactNode | null;
};

const SideEditorCtx = createContext<Ctx | null>(null);

export function SideEditorProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<React.ReactNode | null>(null);
  const [title, setTitle] = useState<string>("");

  const value = useMemo<Ctx>(
    () => ({
      open: (c, t) => {
        setContent(c);
        if (t) setTitle(t);
      },
      close: () => {
        setContent(null);
        setTitle("");
      },
      setTitle,
      isOpen: content != null,
      title,
      content,
    }),
    [content, title]
  );

  return <SideEditorCtx.Provider value={value}>{children}</SideEditorCtx.Provider>;
}

export function useSideEditor() {
  const ctx = useContext(SideEditorCtx);
  if (!ctx) throw new Error("useSideEditor must be used inside <SideEditorProvider>");
  return ctx;
}
