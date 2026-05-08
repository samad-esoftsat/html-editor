import { v4 as uuid } from 'uuid';
import type { ProductSection, ProjectData } from './types';
import { SCHEMA_VERSION } from './types';
import { createDefaultProject } from './defaultProject';

export interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  factory: () => ProjectData;
}

const BLANK_SECTION_COUNT = 8;

function blankSection(): ProductSection {
  return {
    id: uuid(),
    title: '',
    bullets: ['', '', '', '', ''],
    imageSrc: '',
    imageAlt: '',
    ctaText: 'Contact Us',
  };
}

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
    header: {
      logoSrc: '',
      logoAlt: '',
      logoWidth: 390,
      title: '',
      titleFontSize: 18,
      bannerSrc: '',
      bannerAlt: '',
      sectionHeading: '',
      sectionHeadingFontSize: 25,
    },
    sections: Array.from({ length: BLANK_SECTION_COUNT }, blankSection),
    footer: {
      bannerSrc: '',
      bannerAlt: '',
      companyName: '',
      address: '',
      phone: '',
      phoneTel: '',
      email: '',
      websites: [],
      socials: [],
    },
  };
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'Same layout, empty fields. Fill in your own logo, sections, and footer.',
    factory: createBlankProject,
  },
  {
    id: 'globaltt',
    label: 'GlobalTT',
    description: "Pre-filled with GlobalTT's default copy and product sections.",
    factory: createDefaultProject,
  },
];

export function getTemplate(id: string | undefined | null): TemplateDefinition {
  if (!id) return TEMPLATES[0];
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
