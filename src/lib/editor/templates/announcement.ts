import type { ProjectData } from '../types';
import { SCHEMA_VERSION } from '../types';
import {
  makeHeaderBlock, makeFooterBlock, makeHeroBlock, makeArticleBlock, makeCTABannerBlock,
} from '../blocks';

export function createAnnouncementTemplate(): ProjectData {
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
      makeHeaderBlock({ title: 'Big news', sectionHeading: '' }),
      makeHeroBlock({
        title: "We're launching something new",
        subtitle: 'A short, punchy sentence about why this matters.',
        ctaText: 'Get the details',
      }),
      makeArticleBlock({
        title: 'Why this matters',
        body: 'A few sentences of supporting context. Lead with the customer benefit; explain the mechanism second.',
        ctaText: 'Read the post',
        imagePosition: 'left',
      }),
      makeCTABannerBlock({
        title: 'Ready to try it?',
        subtitle: '',
        ctaText: 'Get started',
        align: 'center',
      }),
      makeFooterBlock(),
    ],
  };
}
