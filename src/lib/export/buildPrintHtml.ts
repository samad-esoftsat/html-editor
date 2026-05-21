import type { ProjectData } from '@/lib/editor/types';
import { renderPrintDocument } from './renderPrintDocument';

const TOOLBAR_CSS = `<style>
@media print {
  .no-print { display: none !important; }
}
.no-print {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: #1f2937;
  color: white;
  padding: 8px 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.no-print button {
  background: #4f46e5;
  color: white;
  border: 0;
  border-radius: 4px;
  padding: 6px 12px;
  font-weight: 600;
  cursor: pointer;
}
.no-print button:hover { background: #4338ca; }
</style>`;

const TOOLBAR_HTML = `<div class="no-print pagedjs_not_pageable"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>`;

const PAGED_SCRIPT = `<script src="/vendor/paged.polyfill.js"></script>`;

const AUTO_PRINT_SCRIPT = `<script>
window.addEventListener('load', function () {
  if (window.PagedConfig) {
    window.PagedConfig.after = function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { window.print(); });
      });
    };
  } else {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.print(); });
    });
  }
});
</script>`;

export function buildPrintHtml(data: ProjectData): string {
  const document = renderPrintDocument(data);
  const withCss = document.replace('</head>', `${TOOLBAR_CSS}</head>`);
  const withToolbar = withCss.replace(/<body([^>]*)>/, (_match, attrs) => `<body${attrs}>${TOOLBAR_HTML}`);
  return withToolbar.replace('</body>', `${PAGED_SCRIPT}${AUTO_PRINT_SCRIPT}</body>`);
}
