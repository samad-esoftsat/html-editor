import type { ProjectData } from '@/lib/editor/types';
import { attrEscape } from './escape';

const PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 32mm 12mm 32mm 12mm;
  @top-center    { content: element(header-region); }
  @bottom-center { content: element(footer-region); }
}

* { box-sizing: border-box; }
body { margin: 0; padding: 0; }

.running-header { position: running(header-region); }
.running-footer { position: running(footer-region); }
.running-header, .running-footer { display: none; }

.print-block {
  break-inside: avoid;
  page-break-inside: avoid;
  margin: 0 auto;
  max-width: 710px;
}

main { width: 100%; }
`.trim();

function renderHead(data: ProjectData): string {
  const family = attrEscape(data.global.fontFamily);
  return `<head>
<title>Print preview</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${PRINT_CSS}
body { font-family: ${family}; font-size: ${data.global.baseFontSize}px; color: ${attrEscape(data.global.textColor)}; background: ${attrEscape(data.global.backgroundColor)}; }
</style>
</head>`;
}

export function renderPrintDocument(data: ProjectData): string {
  return `<!doctype html>
<html lang="en">
${renderHead(data)}
<body>
<div class="running-header"></div>
<div class="running-footer"></div>
<main>
</main>
</body>
</html>`;
}
