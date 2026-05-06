'use client';
import type { ProductSection } from '@/lib/editor/types';
export function ProductSectionPanel({ section }: { section: ProductSection; index: number; total: number }) {
  return <div className="rounded-md bg-panel-2 border border-border p-3 text-xs text-muted">{section.title} (Task 11)</div>;
}
