import { describe, expect, it } from 'vitest';
import { renderPrintDocument } from './renderPrintDocument';
import { createDefaultProject } from '../editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../editor/templates';

describe('renderPrintDocument snapshot parity', () => {
  it('GlobalTT print template', async () => {
    await expect(renderPrintDocument(createDefaultProject())).resolves.toMatchSnapshot();
  });

  it('Blank print template', async () => {
    await expect(renderPrintDocument(createBlankProject())).resolves.toMatchSnapshot();
  });

  it('Newsletter print template', async () => {
    await expect(renderPrintDocument(createNewsletterTemplate())).resolves.toMatchSnapshot();
  });

  it('Announcement print template', async () => {
    await expect(renderPrintDocument(createAnnouncementTemplate())).resolves.toMatchSnapshot();
  });

  it('Event Invite print template', async () => {
    await expect(renderPrintDocument(createEventInviteTemplate())).resolves.toMatchSnapshot();
  });
});
