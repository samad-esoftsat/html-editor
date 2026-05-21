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

mkdirSync('src/lib/export/__fixtures__', { recursive: true });

// Email baselines
writeFileSync('src/lib/export/__fixtures__/baseline-globaltt.html',     renderEmail(createDefaultProject()));
writeFileSync('src/lib/export/__fixtures__/baseline-blank.html',        renderEmail(createBlankProject()));
writeFileSync('src/lib/export/__fixtures__/baseline-newsletter.html',   renderEmail(createNewsletterTemplate()));
writeFileSync('src/lib/export/__fixtures__/baseline-announcement.html', renderEmail(createAnnouncementTemplate()));
writeFileSync('src/lib/export/__fixtures__/baseline-event-invite.html', renderEmail(createEventInviteTemplate()));

// Print baselines
writeFileSync('src/lib/export/__fixtures__/print-baseline-globaltt.html',     renderPrintDocument(createDefaultProject()));
writeFileSync('src/lib/export/__fixtures__/print-baseline-blank.html',        renderPrintDocument(createBlankProject()));
writeFileSync('src/lib/export/__fixtures__/print-baseline-newsletter.html',   renderPrintDocument(createNewsletterTemplate()));
writeFileSync('src/lib/export/__fixtures__/print-baseline-announcement.html', renderPrintDocument(createAnnouncementTemplate()));
writeFileSync('src/lib/export/__fixtures__/print-baseline-event-invite.html', renderPrintDocument(createEventInviteTemplate()));

console.log('Wrote baselines');
