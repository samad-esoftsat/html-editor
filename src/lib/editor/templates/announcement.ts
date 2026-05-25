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

function createLegacyAnnouncementTemplate(): LegacyProjectData {
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
      makeLegacyHeaderBlock({ title: 'Big news', sectionHeading: '' }),
      makeLegacyHeroBlock({
        title: "We're launching something new",
        subtitle: 'A short, punchy sentence about why this matters.',
        ctaText: 'Get the details',
      }),
      makeLegacyArticleBlock({
        title: 'Why this matters',
        body: 'A few sentences of supporting context. Lead with the customer benefit; explain the mechanism second.',
        ctaText: 'Read the post',
        imagePosition: 'left',
      }),
      makeLegacyCTABannerBlock({
        title: 'Ready to try it?',
        subtitle: '',
        ctaText: 'Get started',
        align: 'center',
      }),
      makeLegacyFooterBlock(),
    ],
  };
}

export function createAnnouncementTemplate(): ProjectData {
  return migrateV2ToV3(createLegacyAnnouncementTemplate());
}
