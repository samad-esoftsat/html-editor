import { writeFileSync } from 'node:fs';
import { renderPrintDocument } from '../src/lib/export/renderPrintDocument';
import { createDefaultProject } from '../src/lib/editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../src/lib/editor/templates';

const targets = [
  { path: 'src/lib/export/__fixtures__/print-baseline-globaltt.html', factory: createDefaultProject },
  { path: 'src/lib/export/__fixtures__/print-baseline-blank.html', factory: createBlankProject },
  { path: 'src/lib/export/__fixtures__/print-baseline-newsletter.html', factory: createNewsletterTemplate },
  { path: 'src/lib/export/__fixtures__/print-baseline-announcement.html', factory: createAnnouncementTemplate },
  { path: 'src/lib/export/__fixtures__/print-baseline-event-invite.html', factory: createEventInviteTemplate },
];

for (const t of targets) {
  writeFileSync(t.path, renderPrintDocument(t.factory()));
  console.log('wrote', t.path);
}
