'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type SelectionModifier = 'single' | 'range';

interface SectionSelectionContextValue {
  selected: Set<string>;
  anchorId: string | null;
  toggle(id: string, modifier: SelectionModifier): void;
  clear(): void;
  isSelected(id: string): boolean;
}

const Ctx = createContext<SectionSelectionContextValue | null>(null);

interface ProviderProps {
  sectionIds: string[];
  children: ReactNode;
}

export function SectionSelectionProvider({ sectionIds, children }: ProviderProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const sectionIdsRef = useRef(sectionIds);
  sectionIdsRef.current = sectionIds;

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (sectionIds.includes(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
    if (anchorId && !sectionIds.includes(anchorId)) setAnchorId(null);
  }, [sectionIds, anchorId]);

  const toggle = useCallback((id: string, modifier: SelectionModifier) => {
    if (modifier === 'single' || !anchorId) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchorId(id);
      return;
    }
    const ids = sectionIdsRef.current;
    const a = ids.indexOf(anchorId);
    const b = ids.indexOf(id);
    if (a < 0 || b < 0) return;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const range = ids.slice(lo, hi + 1);
    setSelected(new Set(range));
  }, [anchorId]);

  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchorId(null);
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const value = useMemo(
    () => ({ selected, anchorId, toggle, clear, isSelected }),
    [selected, anchorId, toggle, clear, isSelected],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSectionSelection(): SectionSelectionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSectionSelection must be used inside SectionSelectionProvider');
  return v;
}
