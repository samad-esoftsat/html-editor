import { describe, expect, it } from 'vitest';
import { renderEmail } from './renderEmail';
import { createDefaultProject } from '../editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../editor/templates';

describe('renderEmail snapshot parity', () => {
  it('GlobalTT template', async () => {
    await expect(renderEmail(createDefaultProject())).resolves.toMatchSnapshot();
  });

  it('Blank template', async () => {
    await expect(renderEmail(createBlankProject())).resolves.toMatchSnapshot();
  });

  it('Newsletter template', async () => {
    await expect(renderEmail(createNewsletterTemplate())).resolves.toMatchSnapshot();
  });

  it('Announcement template', async () => {
    await expect(renderEmail(createAnnouncementTemplate())).resolves.toMatchSnapshot();
  });

  it('Event Invite template', async () => {
    await expect(renderEmail(createEventInviteTemplate())).resolves.toMatchSnapshot();
  });
});
