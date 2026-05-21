import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderPrintDocument } from './renderPrintDocument';
import { createDefaultProject } from '../editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../editor/templates';

describe('renderPrintDocument snapshot parity', () => {
  it('GlobalTT print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-globaltt.html', 'utf8');
    expect(renderPrintDocument(createDefaultProject())).toBe(baseline);
  });

  it('Blank print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-blank.html', 'utf8');
    expect(renderPrintDocument(createBlankProject())).toBe(baseline);
  });

  it('Newsletter print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-newsletter.html', 'utf8');
    expect(renderPrintDocument(createNewsletterTemplate())).toBe(baseline);
  });

  it('Announcement print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-announcement.html', 'utf8');
    expect(renderPrintDocument(createAnnouncementTemplate())).toBe(baseline);
  });

  it('Event Invite print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-event-invite.html', 'utf8');
    expect(renderPrintDocument(createEventInviteTemplate())).toBe(baseline);
  });
});
