import type { ReactElement } from 'react';
import { Element } from '@craftjs/core';
import { Button } from './Button';
import { Column } from './Column';
import { Heading } from './Heading';
import { Image } from './Image';
import { List } from './List';
import { Row } from './Row';
import { Section } from './Section';
import { Text } from './Text';

export function createBlankSectionElement(): ReactElement {
  return (
    <Element is={Section} canvas paddingX={16} paddingY={16}>
      <Element is={Row} canvas>
        <Element is={Column} canvas widthPercent={100}>
          <Element is={Heading} text="Section heading" level={2} />
          <Element is={Text} text="Add copy here." />
        </Element>
      </Element>
    </Element>
  );
}

export function createHeroPresetElement(): ReactElement {
  return (
    <Element is={Section} canvas paddingX={24} paddingY={40}>
      <Element is={Row} canvas>
        <Element is={Column} canvas widthPercent={100}>
          <Element is={Image} src="" alt="" width={320} align="center" />
          <Element is={Heading} text="Big headline" level={1} align="center" />
          <Element is={Text} text="Supporting subtitle" align="center" />
          <Element is={Button} label="Learn more" align="center" />
        </Element>
      </Element>
    </Element>
  );
}

export function createArticlePresetElement(): ReactElement {
  return (
    <Element is={Section} canvas paddingX={24} paddingY={24}>
      <Element is={Row} canvas gap={16}>
        <Element is={Column} canvas widthPercent={40}>
          <Element is={Image} src="" alt="" width={260} align="center" />
        </Element>
        <Element is={Column} canvas widthPercent={60}>
          <Element is={Heading} text="Article title" level={2} />
          <Element is={Text} text="A short supporting paragraph." />
          <Element is={Button} label="Read more" />
        </Element>
      </Element>
    </Element>
  );
}

export function createProductSectionPresetElement(): ReactElement {
  return (
    <Element is={Section} canvas paddingX={16} paddingY={16}>
      <Element is={Row} canvas gap={16}>
        <Element is={Column} canvas widthPercent={50}>
          <Element is={Image} src="" alt="" width={320} align="center" />
        </Element>
        <Element is={Column} canvas widthPercent={50}>
          <Element is={Heading} text="Product section" level={2} />
          <Element is={List} items={['Feature one', 'Feature two', 'Feature three']} />
          <Element is={Button} label="Contact us" />
        </Element>
      </Element>
    </Element>
  );
}

export function createCtaBannerPresetElement(): ReactElement {
  return (
    <Element is={Section} canvas paddingX={24} paddingY={32}>
      <Element is={Row} canvas>
        <Element is={Column} canvas widthPercent={100}>
          <Element is={Heading} text="Ready to get started?" level={2} align="center" />
          <Element is={Text} text="A short call to action." align="center" />
          <Element is={Button} label="Get in touch" align="center" />
        </Element>
      </Element>
    </Element>
  );
}
