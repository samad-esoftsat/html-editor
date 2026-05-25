'use client';
import { useEffect, useState } from 'react';
import { useEditor as useStoreEditor } from '@/lib/editor/StoreProvider';
import { paperMetricsFor } from '@/lib/editor/types';

interface Props {
  /** Element whose height drives the page count (the canvas card). */
  targetRef: React.RefObject<HTMLElement | null>;
}

interface BreakMarker {
  /** Y-position in canvas pixels where the break line is drawn. */
  y: number;
  /** Which page this break ends (1-based — "End of page 1" → first break). */
  pageNumber: number;
}

export function PageBreakOverlay({ targetRef }: Props) {
  const [layout, setLayout] = useState<{ breaks: BreakMarker[]; pageCount: number }>({
    breaks: [],
    pageCount: 1,
  });
  const repeatHeaderFooter = useStoreEditor((s) => s.data.global.repeatHeaderFooter === true);
  const global = useStoreEditor((s) => s.data.global);
  const paper = paperMetricsFor(global);
  const pageHeight = repeatHeaderFooter ? paper.contentHeightRunningPx : paper.contentHeightPx;

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    // Mirror PagedJS `break-inside: avoid` on `main > section`: walk each
    // top-level body section (skipping header/footer when running header is
    // on) and emit a break BEFORE any section that won't fit in the
    // remaining page space. The break y-position is the section's top, not
    // an arbitrary mid-section pixel.
    const measure = () => {
      const containerTop = el.getBoundingClientRect().top;
      const sections = Array.from(
        el.querySelectorAll('[data-craft-section]'),
      ) as HTMLElement[];

      const bodySections = sections.filter((s) => {
        const role = s.getAttribute('data-section-role');
        if (!repeatHeaderFooter) return true;
        return role !== 'header' && role !== 'footer';
      });

      const breaks: BreakMarker[] = [];
      let usedOnPage = 0;
      let pageNumber = 1;

      for (const section of bodySections) {
        const rect = section.getBoundingClientRect();
        const sectionTop = rect.top - containerTop;
        const sectionHeight = section.offsetHeight;

        // If this section won't fit in what's left of the current page, push
        // it to the next page and draw the break marker right above it.
        if (usedOnPage > 0 && usedOnPage + sectionHeight > pageHeight) {
          breaks.push({ y: sectionTop, pageNumber });
          pageNumber += 1;
          usedOnPage = sectionHeight;
        } else {
          usedOnPage += sectionHeight;
        }
      }

      setLayout({ breaks, pageCount: pageNumber });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      mo.disconnect();
    };
  }, [targetRef, repeatHeaderFooter, pageHeight]);

  const { breaks, pageCount } = layout;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {/* Top-right page-count pill */}
      <div
        style={{
          position: 'sticky',
          top: 8,
          marginLeft: 'auto',
          width: 'fit-content',
          padding: '4px 10px',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--color-brand, #f1592a)',
          background: 'var(--color-ed-panel-2, rgba(255,255,255,0.9))',
          border: '1px solid var(--color-brand, #f1592a)',
          borderRadius: 999,
          marginRight: 8,
          marginTop: 8,
        }}
      >
        {pageCount} page{pageCount === 1 ? '' : 's'}
      </div>

      {/* Section-aware break markers. The y-position is the top of the
          section that gets pushed to the next page, so the dashed line
          lands in the gap BETWEEN sections (mirroring PagedJS' actual
          decision under `break-inside: avoid`). */}
      {breaks.map((mark) => (
        <div
          key={`${mark.pageNumber}-${mark.y}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: mark.y,
            borderTop: '1px dashed var(--color-brand, #f1592a)',
            opacity: 0.55,
          }}
        >
          <span
            style={{
              position: 'absolute',
              right: 0,
              top: -10,
              background: 'var(--color-ed-panel-2, #fff)',
              color: 'var(--color-brand, #f1592a)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              padding: '1px 6px',
              border: '1px solid var(--color-brand, #f1592a)',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}
          >
            End of page {mark.pageNumber}
          </span>
        </div>
      ))}
    </div>
  );
}
