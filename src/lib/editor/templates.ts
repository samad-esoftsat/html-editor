import type { ProjectData } from './types';
import { SCHEMA_VERSION } from './types';
import { makeHeaderBlock, makeFooterBlock, makeProductSectionBlock } from './blocks';
import { createDefaultProject } from './defaultProject';
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

export function createBlankProject(): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
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
      makeHeaderBlock(),
      ...Array.from({ length: BLANK_SECTION_COUNT }, () =>
        makeProductSectionBlock({
          title: '',
          bullets: ['', '', '', '', ''],
          ctaText: 'Contact Us',
        }),
      ),
      makeFooterBlock(),
    ],
  };
}

export { createNewsletterTemplate, createAnnouncementTemplate, createEventInviteTemplate };

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'blank',        label: 'Blank',        description: 'Same layout, empty fields. Fill in your own logo, sections, and footer.', factory: createBlankProject,         group: 'Quick start' },
  { id: 'globaltt',     label: 'GlobalTT',     description: "Pre-filled with GlobalTT's default copy and product sections.",          factory: createDefaultProject,       group: 'Quick start' },
  { id: 'newsletter',   label: 'Newsletter',   description: 'Hero + articles + CTA. Recurring digest format.',                          factory: createNewsletterTemplate,   group: 'Layouts'     },
  { id: 'announcement', label: 'Announcement', description: 'Hero + supporting article + CTA. Single big message.',                     factory: createAnnouncementTemplate, group: 'Layouts'     },
  { id: 'event-invite', label: 'Event invite', description: 'Hero, agenda, speakers/sessions, RSVP CTA.',                               factory: createEventInviteTemplate,  group: 'Layouts'     },
];

export function getTemplate(id: string | undefined | null): TemplateDefinition {
  if (!id) return TEMPLATES[0];
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
