const PRINT_STYLE = `<style>
@page { size: A4 portrait; margin: 12mm; }
@media print {
  body { background: white; }
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

const PRINT_SCRIPT = `<script>
(function () {
  window.addEventListener('load', function () {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.print(); });
    });
  });
})();
</script>`;

const TOOLBAR = `<div class="no-print"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>`;

export function buildPrintHtml(emailHtml: string): string {
  if (!emailHtml.includes('</head>')) {
    throw new Error('buildPrintHtml: input must contain a </head> tag');
  }
  const withHead = emailHtml.replace('</head>', `${PRINT_STYLE}${PRINT_SCRIPT}</head>`);
  if (!/<body[^>]*>/i.test(withHead)) {
    throw new Error('buildPrintHtml: input must contain a <body> tag');
  }
  // Insert toolbar as the first child of <body>. Match the opening <body ...> tag.
  return withHead.replace(/<body([^>]*)>/, (_match, attrs) => `<body${attrs}>${TOOLBAR}`);
}
