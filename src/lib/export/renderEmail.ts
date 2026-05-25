import type { ProjectData } from '@/lib/editor/types';
import { attrEscape } from './escape';
import { renderTreeMarkup } from './renderTree';

function renderHead(): string {
  return `<head>
<title></title>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }
  p { line-height: inherit; }
  img { max-width: 100%; height: auto; }
</style>
</head>`;
}

async function renderBody(data: ProjectData): Promise<string> {
  const inner = await renderTreeMarkup(data.tree, data.global, 'email');
  return `<body style="margin: 0; padding: 0; background-color: ${attrEscape(data.global.backgroundColor)}; font-family: ${attrEscape(data.global.fontFamily)}; font-size: ${data.global.baseFontSize}px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(data.global.backgroundColor)};">
  <tr>
    <td align="center">
      ${inner}
    </td>
  </tr>
</table>
</body>`;
}

export async function renderEmail(data: ProjectData): Promise<string> {
  return `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
${renderHead()}
${await renderBody(data)}
</html>`;
}
