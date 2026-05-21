import type { ProjectData } from '../types';
import { SCHEMA_VERSION } from '../types';
import {
  makeHeaderBlock, makeFooterBlock,
  makeHeroBlock, makeArticleBlock, makeCTABannerBlock, makeProductSectionBlock,
} from '../blocks';

export function createEventInviteTemplate(): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
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
      makeHeaderBlock({ title: "You're invited", sectionHeading: '' }),
      makeHeroBlock({
        title: 'Our annual event',
        subtitle: 'Date · Location · Format',
        ctaText: 'RSVP',
      }),
      makeArticleBlock({
        title: 'What to expect',
        body: 'A short description of the day. Cover format, audience, and what attendees will leave with.',
        ctaText: 'View agenda',
        imagePosition: 'left',
      }),
      makeProductSectionBlock({
        title: 'Session one',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeProductSectionBlock({
        title: 'Session two',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeProductSectionBlock({
        title: 'Session three',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeCTABannerBlock({
        title: 'See you there?',
        subtitle: 'Reserve your spot — seats are limited.',
        ctaText: 'Reserve your spot →',
        align: 'center',
      }),
      makeFooterBlock(),
    ],
  };
}
