'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';

export type EditorMode = 'edit' | 'preview';

interface EditorModeContextValue {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
}

const EditorModeContext = createContext<EditorModeContextValue | null>(null);

export function EditorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<EditorMode>('edit');
  return (
    <EditorModeContext.Provider value={{ mode, setMode }}>
      {children}
    </EditorModeContext.Provider>
  );
}

export function useEditorMode(): EditorModeContextValue {
  const ctx = useContext(EditorModeContext);
  if (!ctx) throw new Error('useEditorMode must be used inside EditorModeProvider');
  return ctx;
}
