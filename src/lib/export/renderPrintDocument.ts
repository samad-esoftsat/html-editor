import type { ProjectData } from '@/lib/editor/types';
import { paperMetricsFor } from '@/lib/editor/types';
import { attrEscape } from './escape';
import { findRoleSectionId, renderSubtreeMarkup, renderTreeMarkup } from './renderTree';

function basePrintCss(paperCssSize: string): string {
  return `@page {
  size: ${paperCssSize} portrait;
  margin: 18mm 14mm;
}

* { box-sizing: border-box; }
body { margin: 0; padding: 0; }
main { width: 100%; }
main > section { break-inside: avoid; }`;
}

// PagedJS running-region CSS. When the project has `repeatHeaderFooter`,
// a compact header (logo + banner only) is rendered into @top-center on
// every page, and the full footer Section is rendered into @bottom-center.
// Page margins are widened so the running regions have room to breathe.
// To make the dark footer band extend edge-to-edge of the printed page, we
// use negative horizontal margins (-14mm each side) inside .page-footer so
// the background bleeds past the content area into the page-margin space.
// Running header/footer use the same Section subtree as the editor renders.
// Their internal spacing (Column gap, Row gap, Section padding, etc.) flows
// through to PDF automatically — no hardcoded margins here.
// The only print-only rules below are:
//   - position: running() — tells PagedJS to lift the element into the page
//     margin box on every page
//   - negative horizontal margins on .page-footer/.page-header > section —
//     extend the Section's background color (e.g., the footer's dark band)
//     past the content area to the printed page edge.
const RUNNING_CSS = `
@page {
  margin: 60mm 14mm 85mm 14mm;
  @top-center {
    content: element(pageHeader);
    vertical-align: top;
  }
  @bottom-center {
    content: element(pageFooter);
    vertical-align: bottom;
  }
}
.page-header {
  position: running(pageHeader);
  width: 100%;
}
.page-footer {
  position: running(pageFooter);
  width: 100%;
}
.page-header > section,
.page-footer > section {
  margin-left: -14mm;
  margin-right: -14mm;
  padding-left: 14mm;
  padding-right: 14mm;
}
.page-header img,
.page-footer img {
  max-width: 100%;
}
/* Keep each top-level Section together where possible so PagedJS doesn't
   split a product section across pages. */
main > section {
  break-inside: avoid;
}
`.trim();

export async function renderPrintDocument(data: ProjectData): Promise<string> {
  const repeat = data.global.repeatHeaderFooter === true;
  const paper = paperMetricsFor(data.global);
  const BASE_PRINT_CSS = basePrintCss(paper.cssSize);

  const headerSectionId = repeat ? findRoleSectionId(data.tree, 'header') : null;
  const footerSectionId = repeat ? findRoleSectionId(data.tree, 'footer') : null;

  const excludeIds = new Set<string>();
  if (headerSectionId) excludeIds.add(headerSectionId);
  if (footerSectionId) excludeIds.add(footerSectionId);

  // Running header/footer render the FULL Section subtree so editor changes
  // to spacing/styling propagate through. If the user wants something not to
  // repeat on every page (e.g., a section heading), they should move it out
  // of the header Section in the editor.
  const [innerBody, headerHtml, footerHtml] = await Promise.all([
    renderTreeMarkup(data.tree, data.global, 'print', { excludeIds }),
    headerSectionId ? renderSubtreeMarkup(data.tree, headerSectionId, data.global, 'print') : Promise.resolve(''),
    footerSectionId ? renderSubtreeMarkup(data.tree, footerSectionId, data.global, 'print') : Promise.resolve(''),
  ]);

  const printCss = repeat ? `${BASE_PRINT_CSS}\n${RUNNING_CSS}` : BASE_PRINT_CSS;
  const runningBlocks = repeat
    ? `${headerHtml ? `<div class="page-header">${headerHtml}</div>` : ''}${footerHtml ? `<div class="page-footer">${footerHtml}</div>` : ''}`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <title>Print preview</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${printCss}
body {
  background: ${attrEscape(data.global.backgroundColor)};
  color: ${attrEscape(data.global.textColor)};
  font-family: ${attrEscape(data.global.fontFamily)};
  font-size: ${data.global.baseFontSize}px;
}
  </style>
</head>
<body>
  ${runningBlocks}
  <main>${innerBody}</main>
</body>
</html>`;
}
