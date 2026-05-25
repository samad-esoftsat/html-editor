import { migrateV2ToV3 } from '../migrate';
import {
  makeLegacyArticleBlock,
  makeLegacyCTABannerBlock,
  makeLegacyFooterBlock,
  makeLegacyHeaderBlock,
  makeLegacyHeroBlock,
  makeLegacyProductSectionBlock,
  type LegacyProjectData,
} from '../legacy';
import type { ProjectData } from '../types';

function createLegacyEventInviteTemplate(): LegacyProjectData {
  return {
    schemaVersion: 2,
    global: {
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
      baseFontSize: 16,
      headingFontSize: 25,
      textColor: '#1c1c1c',
      buttonColor: '#f1592a',
      buttonTextColor: '#ffffff',
      accentColor: '#f1592a',
      footerBackgroundColor: '#000000',
      footerTextColor: '#fafafa',
      contactUrl: '',
    },
    blocks: [
      makeLegacyHeaderBlock({ title: "You're invited", sectionHeading: '' }),
      makeLegacyHeroBlock({
        title: 'Our annual event',
        subtitle: 'Date - Location - Format',
        ctaText: 'RSVP',
      }),
      makeLegacyArticleBlock({
        title: 'What to expect',
        body: 'A short description of the day. Cover format, audience, and what attendees will leave with.',
        ctaText: 'View agenda',
        imagePosition: 'left',
      }),
      makeLegacyProductSectionBlock({
        title: 'Session one',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeLegacyProductSectionBlock({
        title: 'Session two',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeLegacyProductSectionBlock({
        title: 'Session three',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeLegacyCTABannerBlock({
        title: 'See you there?',
        subtitle: 'Reserve your spot - seats are limited.',
        ctaText: 'Reserve your spot ->',
        align: 'center',
      }),
      makeLegacyFooterBlock(),
    ],
  };
}

export function createEventInviteTemplate(): ProjectData {
  return migrateV2ToV3(createLegacyEventInviteTemplate());
}
