import { migrateV2ToV3 } from '../migrate';
import {
  makeLegacyArticleBlock,
  makeLegacyCTABannerBlock,
  makeLegacyFooterBlock,
  makeLegacyHeaderBlock,
  makeLegacyHeroBlock,
  type LegacyProjectData,
} from '../legacy';
import type { ProjectData } from '../types';

function createLegacyNewsletterTemplate(): LegacyProjectData {
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
      makeLegacyHeaderBlock({ title: 'Monthly update', sectionHeading: 'What we shipped this month' }),
      makeLegacyHeroBlock({
        title: 'This month at our company',
        subtitle: 'A short note from the team - the highlights, in one place.',
        ctaText: 'See the full update',
      }),
      makeLegacyArticleBlock({
        title: 'Story one',
        body: 'A short paragraph or two about the first story. Keep it under five lines.',
        ctaText: 'Read more',
        imagePosition: 'top',
      }),
      makeLegacyArticleBlock({
        title: 'Story two',
        body: 'Another short paragraph. Newsletter readers skim - short beats long.',
        ctaText: 'Read more',
        imagePosition: 'top',
      }),
      makeLegacyArticleBlock({
        title: 'Story three',
        body: 'Wrap up with a third item that nudges readers toward the next step.',
        ctaText: 'Read more',
        imagePosition: 'top',
      }),
      makeLegacyCTABannerBlock({
        title: 'Want more?',
        subtitle: 'Get future editions straight to your inbox.',
        ctaText: 'Subscribe ->',
        align: 'center',
      }),
      makeLegacyFooterBlock(),
    ],
  };
}

export function createNewsletterTemplate(): ProjectData {
  return migrateV2ToV3(createLegacyNewsletterTemplate());
}
