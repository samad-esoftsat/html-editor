import { Element, useEditor as useCraftEditor } from '@craftjs/core';
import { FileText, Heading1, Image as ImageIcon, LayoutList, List, Minus, MousePointerSquareDashed, SquareStack, Type } from 'lucide-react';
import { Button as UIButton } from '@/components/ui/Button';
import { Button } from '@/components/editor/craft/Button';
import { Heading } from '@/components/editor/craft/Heading';
import { Image } from '@/components/editor/craft/Image';
import { List as ListBlock } from '@/components/editor/craft/List';
import { Spacer } from '@/components/editor/craft/Spacer';
import { Text } from '@/components/editor/craft/Text';
import {
  createArticlePresetElement,
  createBlankSectionElement,
  createCtaBannerPresetElement,
  createHeroPresetElement,
  createProductSectionPresetElement,
} from '@/components/editor/craft/presets';
import { Divider } from '@/components/editor/craft/Divider';

const PALETTE_ITEMS = [
  { icon: SquareStack, label: 'Section', element: createBlankSectionElement() },
  { icon: Heading1, label: 'Heading', element: <Element is={Heading} text="Heading" level={2} /> },
  { icon: Type, label: 'Text', element: <Element is={Text} text="Body text" /> },
  { icon: ImageIcon, label: 'Image', element: <Element is={Image} src="" alt="" width={300} align="center" /> },
  { icon: MousePointerSquareDashed, label: 'Button', element: <Element is={Button} label="Button" /> },
  { icon: Minus, label: 'Divider', element: <Element is={Divider} /> },
  { icon: LayoutList, label: 'Spacer', element: <Element is={Spacer} height={24} /> },
  { icon: List, label: 'List', element: <Element is={ListBlock} items={['Item one', 'Item two']} /> },
  { icon: ImageIcon, label: 'Hero preset', element: createHeroPresetElement() },
  { icon: FileText, label: 'Article preset', element: createArticlePresetElement() },
  { icon: LayoutList, label: 'Product preset', element: createProductSectionPresetElement() },
  { icon: MousePointerSquareDashed, label: 'CTA preset', element: createCtaBannerPresetElement() },
];

export function Palette() {
  const { connectors } = useCraftEditor();

  return (
    <div className="space-y-2">
      {PALETTE_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <UIButton
            key={item.label}
            variant="secondary"
            className="w-full justify-start"
            ref={(element) => {
              if (element) {
                connectors.create(element, item.element);
              }
            }}
          >
            <Icon size={14} />
            {item.label}
          </UIButton>
        );
      })}
    </div>
  );
}
