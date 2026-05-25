import { writeFileSync, mkdirSync } from 'node:fs';
import { renderEmail } from '../src/lib/export/renderEmail';
import { renderPrintDocument } from '../src/lib/export/renderPrintDocument';
import { createDefaultProject } from '../src/lib/editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../src/lib/editor/templates';

async function main() {
  mkdirSync('src/lib/export/__fixtures__', { recursive: true });

  // Email baselines
  writeFileSync('src/lib/export/__fixtures__/baseline-globaltt.html', await renderEmail(createDefaultProject()));
  writeFileSync('src/lib/export/__fixtures__/baseline-blank.html', await renderEmail(createBlankProject()));
  writeFileSync('src/lib/export/__fixtures__/baseline-newsletter.html', await renderEmail(createNewsletterTemplate()));
  writeFileSync('src/lib/export/__fixtures__/baseline-announcement.html', await renderEmail(createAnnouncementTemplate()));
  writeFileSync('src/lib/export/__fixtures__/baseline-event-invite.html', await renderEmail(createEventInviteTemplate()));

  // Print baselines
  writeFileSync('src/lib/export/__fixtures__/print-baseline-globaltt.html', await renderPrintDocument(createDefaultProject()));
  writeFileSync('src/lib/export/__fixtures__/print-baseline-blank.html', await renderPrintDocument(createBlankProject()));
  writeFileSync('src/lib/export/__fixtures__/print-baseline-newsletter.html', await renderPrintDocument(createNewsletterTemplate()));
  writeFileSync('src/lib/export/__fixtures__/print-baseline-announcement.html', await renderPrintDocument(createAnnouncementTemplate()));
  writeFileSync('src/lib/export/__fixtures__/print-baseline-event-invite.html', await renderPrintDocument(createEventInviteTemplate()));

  console.log('Wrote baselines');
}

void main();
