import { migrateV2ToV3 } from './migrate';
import {
  makeLegacyFooterBlock,
  makeLegacyHeaderBlock,
  makeLegacyProductSectionBlock,
  type LegacyProjectData,
} from './legacy';
import type { ProjectData } from './types';
import { createDefaultLegacyProject } from './defaultProject';
import { createNewsletterTemplate } from './templates/newsletter';
import { createAnnouncementTemplate } from './templates/announcement';
import { createEventInviteTemplate } from './templates/eventInvite';

export interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  factory: () => ProjectData;
  group: 'Quick start' | 'Layouts';
}

const BLANK_SECTION_COUNT = 8;

export function createBlankLegacyProject(): LegacyProjectData {
  return {
    schemaVersion: 2,
    global: {
      backgroundColor: '#d0d0d0',
      fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
      baseFontSize: 16,
      headingFontSize: 25,
      textColor: '#000000',
      buttonColor: '#f1592a',
      buttonTextColor: '#ffffff',
      accentColor: '#f1592a',
      footerBackgroundColor: '#000000',
      footerTextColor: '#fafafa',
      contactUrl: '',
    },
    blocks: [
      makeLegacyHeaderBlock(),
      ...Array.from({ length: BLANK_SECTION_COUNT }, () =>
        makeLegacyProductSectionBlock({
          title: '',
          bullets: ['', '', '', '', ''],
          ctaText: 'Contact Us',
        }),
      ),
      makeLegacyFooterBlock(),
    ],
  };
}

export function createBlankProject(): ProjectData {
  return migrateV2ToV3(createBlankLegacyProject());
}

export { createNewsletterTemplate, createAnnouncementTemplate, createEventInviteTemplate };

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'Same layout, empty fields. Fill in your own logo, sections, and footer.',
    factory: createBlankProject,
    group: 'Quick start',
  },
  {
    id: 'globaltt',
    label: 'GlobalTT',
    description: "Pre-filled with GlobalTT's default copy and product sections.",
    factory: () => migrateV2ToV3(createDefaultLegacyProject()),
    group: 'Quick start',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Hero + articles + CTA. Recurring digest format.',
    factory: createNewsletterTemplate,
    group: 'Layouts',
  },
  {
    id: 'announcement',
    label: 'Announcement',
    description: 'Hero + supporting article + CTA. Single big message.',
    factory: createAnnouncementTemplate,
    group: 'Layouts',
  },
  {
    id: 'event-invite',
    label: 'Event invite',
    description: 'Hero, agenda, speakers/sessions, RSVP CTA.',
    factory: createEventInviteTemplate,
    group: 'Layouts',
  },
];

export function getTemplate(id: string | undefined | null): TemplateDefinition {
  if (!id) {
    return TEMPLATES[0];
  }
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}
