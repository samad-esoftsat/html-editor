import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderEmail } from './renderEmail';
import { createDefaultProject } from '../editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../editor/templates';

describe('renderEmail snapshot parity', () => {
  it('GlobalTT template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-globaltt.html', 'utf8');
    expect(renderEmail(createDefaultProject())).toBe(baseline);
  });

  it('Blank template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-blank.html', 'utf8');
    expect(renderEmail(createBlankProject())).toBe(baseline);
  });

  it('Newsletter template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-newsletter.html', 'utf8');
    expect(renderEmail(createNewsletterTemplate())).toBe(baseline);
  });

  it('Announcement template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-announcement.html', 'utf8');
    expect(renderEmail(createAnnouncementTemplate())).toBe(baseline);
  });

  it('Event Invite template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-event-invite.html', 'utf8');
    expect(renderEmail(createEventInviteTemplate())).toBe(baseline);
  });
});
