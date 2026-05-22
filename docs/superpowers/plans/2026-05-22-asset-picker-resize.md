# Asset Picker UI/UX Revamp + Image Resize Handles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing Asset Picker modal (chrome only — zero feature changes) to match the warm-editorial dark-editor visual language already established for the rest of the app, AND add interactive corner-handle resize widgets to images on the canvas so users can drag-resize images directly without leaving the canvas.

**Architecture:**
- **Asset Picker:** purely a className/JSX-structure refresh of `AssetPicker.tsx`, `AssetLibraryGrid.tsx`, `GenerateImageForm.tsx`. The function signatures, state shape, callbacks, and feature set are unchanged.
- **Image resize:** a new `<ResizableImage>` wrapper around `<EditableImage>` rendered only in edit mode. It uses native pointer events (no extra deps) to draw 4 corner handles + a live `WxH` badge during drag, persisting the chosen width to a new per-block field (`imageWidth?: number` on `ProductSectionBlock`, `HeroBlock`, `ArticleBlock`; `bannerWidth?: number` on `FooterBlock`). `HeaderBlock.logoWidth` already exists and is reused. The width is also honored by `renderEmail.ts` and `renderPrintDocument.ts` so exports match the canvas.

**Tech Stack:** Next.js 15 App Router, React, TypeScript strict, Tailwind v4, lucide-react icons, vitest + @testing-library/react + jsdom. No new runtime deps.

**Stitch references (visual ground truth):**
- Library tab — `projects/15011100066150914960/screens/1692fefca8f54654ace90838c00ca362`
- Upload tab — `projects/15011100066150914960/screens/1c13ae9d54e142cea56e73d26cc3f2bd`
- Generate tab — `projects/15011100066150914960/screens/51f1a391f4e4439ca8af555bc95bf22d`

---

## File Structure

**Files to create:**
- `src/components/editor/AssetPickerTabs.tsx` — extracted tab pill row (new file because the inline `TabButton` becomes a self-contained subcomponent with its own visual treatment)
- `src/components/editor/canvas/ResizableImage.tsx` — wraps a child image element with 4 corner handles + width-tracking
- `tests/unit/ResizableImage.test.tsx` — unit tests for drag math + width persistence
- `tests/unit/AssetPicker.smoke.test.tsx` — render-without-crash smoke test for the restyled modal (exists? check before creating)

**Files to modify:**
- `src/components/editor/AssetPicker.tsx` — restyled modal shell, header, footer
- `src/components/editor/AssetLibraryGrid.tsx` — restyled grid cards
- `src/components/editor/GenerateImageForm.tsx` — restyled prompt + references + selects + primary CTA
- `src/components/editor/editable/EditableImage.tsx` — wraps the rendered `<img>` in `<ResizableImage>` when `onWidthChange` prop is provided AND we're in edit mode
- `src/lib/editor/types.ts` — add `imageWidth?: number` to ProductSectionBlock/HeroBlock/ArticleBlock; add `bannerWidth?: number` to FooterBlock
- `src/components/editor/blocks/ProductSectionView.tsx`, `HeroBlockView.tsx`, `ArticleView.tsx`, `FooterBlockView.tsx`, `HeaderBlockView.tsx` — pass `imageWidth`/`logoWidth`/`bannerWidth` through to `EditableImage` AND give it an `onWidthChange` callback that calls the appropriate `updateBlock` action
- `src/lib/export/renderEmail.ts` — honor the width fields on output `<img>` style
- `src/lib/export/renderPrintDocument.ts` — same
- `src/app/globals.css` — small CSS additions for `.resize-handle`, `.resize-badge`, `.cta-button-primary`, `.asset-card`, `.asset-tab-pill`

**Tasks 1-12 below; each ends in a commit.**

---

## Task 1: Add per-block image width fields to types + tests

**Files:**
- Modify: `src/lib/editor/types.ts`
- Test: `tests/unit/types.imageWidth.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/types.imageWidth.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { ArticleBlock, CTABannerBlock, FooterBlock, HeaderBlock, HeroBlock, ProductSectionBlock } from '@/lib/editor/types';

describe('Block image width fields', () => {
  it('ProductSectionBlock accepts an optional imageWidth number', () => {
    expectTypeOf<ProductSectionBlock['imageWidth']>().toEqualTypeOf<number | undefined>();
  });

  it('HeroBlock accepts an optional imageWidth number', () => {
    expectTypeOf<HeroBlock['imageWidth']>().toEqualTypeOf<number | undefined>();
  });

  it('ArticleBlock accepts an optional imageWidth number', () => {
    expectTypeOf<ArticleBlock['imageWidth']>().toEqualTypeOf<number | undefined>();
  });

  it('FooterBlock accepts an optional bannerWidth number', () => {
    expectTypeOf<FooterBlock['bannerWidth']>().toEqualTypeOf<number | undefined>();
  });

  it('HeaderBlock already has logoWidth (sanity check)', () => {
    expectTypeOf<HeaderBlock['logoWidth']>().toEqualTypeOf<number>();
  });

  it('CTABannerBlock has no image, so no width field expected', () => {
    // structural check only; no assertion needed.
    const c = {} as CTABannerBlock;
    expect(c).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

`npx vitest run tests/unit/types.imageWidth.test.ts`. Expected: TYPE failures for `imageWidth` / `bannerWidth`.

- [ ] **Step 3: Add the fields**

In `src/lib/editor/types.ts`:

Find `ProductSectionBlock` (around line 41). Add `imageWidth?: number;` after `imageAlt: string;`:

```ts
export interface ProductSectionBlock extends BlockBase {
  type: 'product-section';
  title: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
  imageWidth?: number;
  ctaText: string;
  ctaUrl?: string;
  titleFontSize?: number;
  bulletFontSize?: number;
  textColor?: string;
  buttonColor?: string;
  backgroundColor?: string;
}
```

Find `HeroBlock` (around line 71). Add `imageWidth?: number;` after `imageAlt: string;`:

```ts
export interface HeroBlock extends BlockBase {
  type: 'hero';
  imageSrc: string;
  imageAlt: string;
  imageWidth?: number;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
}
```

Find `ArticleBlock` (around line 86). Add `imageWidth?: number;` after `imageAlt: string;`:

```ts
export interface ArticleBlock extends BlockBase {
  type: 'article';
  imageSrc: string;
  imageAlt: string;
  imageWidth?: number;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl?: string;
  imagePosition: 'top' | 'left' | 'right';
  titleFontSize?: number;
  bodyFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
}
```

Find `FooterBlock` (around line 56). Add `bannerWidth?: number;` after `bannerAlt: string;`:

```ts
export interface FooterBlock extends BlockBase {
  type: 'footer';
  bannerSrc: string;
  bannerAlt: string;
  bannerWidth?: number;
  companyName: string;
  address: string;
  phone: string;
  phoneTel: string;
  email: string;
  websites: WebsiteLink[];
  socials: SocialLink[];
  backgroundColor?: string;
  textColor?: string;
}
```

- [ ] **Step 4: Run to verify PASS**

`npx vitest run tests/unit/types.imageWidth.test.ts && npx tsc --noEmit`. Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/types.ts tests/unit/types.imageWidth.test.ts
git commit -m "feat(types): add imageWidth/bannerWidth fields to block variants"
```

---

## Task 2: ResizableImage component — pure logic + drag math

**Files:**
- Create: `src/components/editor/canvas/ResizableImage.tsx`
- Test: `tests/unit/ResizableImage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ResizableImage.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { ResizableImage } from '@/components/editor/canvas/ResizableImage';

function setRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () => ({
    x: rect.x ?? 0, y: rect.y ?? 0,
    left: rect.left ?? rect.x ?? 0, top: rect.top ?? rect.y ?? 0,
    right: (rect.left ?? rect.x ?? 0) + (rect.width ?? 0),
    bottom: (rect.top ?? rect.y ?? 0) + (rect.height ?? 0),
    width: rect.width ?? 0, height: rect.height ?? 0,
    toJSON: () => ({}),
  });
}

describe('ResizableImage', () => {
  it('renders children passthrough when not active', () => {
    const r = render(
      <ResizableImage width={200} onWidthChange={() => {}} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    expect(r.getByTestId('inner')).toBeTruthy();
  });

  it('renders 4 corner handles', () => {
    const r = render(
      <ResizableImage width={200} onWidthChange={() => {}} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    expect(r.container.querySelectorAll('[data-resize-handle]').length).toBe(4);
  });

  it('calls onWidthChange with new width when dragging bottom-right handle', () => {
    const onWidthChange = vi.fn();
    const r = render(
      <ResizableImage width={200} onWidthChange={onWidthChange} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    const wrap = r.container.querySelector('[data-resizable-wrap]') as HTMLElement;
    setRect(wrap, { left: 100, top: 100, width: 200, height: 100 });
    const handle = r.container.querySelector('[data-resize-handle="br"]') as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 360, clientY: 230, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 360, clientY: 230, pointerId: 1 });
    expect(onWidthChange).toHaveBeenCalled();
    const finalWidth = onWidthChange.mock.calls.at(-1)![0];
    expect(finalWidth).toBeGreaterThan(200);
    expect(finalWidth).toBeLessThanOrEqual(360);
  });

  it('clamps to minWidth=40 when dragging shrinks below it', () => {
    const onWidthChange = vi.fn();
    const r = render(
      <ResizableImage width={200} onWidthChange={onWidthChange} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    const wrap = r.container.querySelector('[data-resizable-wrap]') as HTMLElement;
    setRect(wrap, { left: 100, top: 100, width: 200, height: 100 });
    const handle = r.container.querySelector('[data-resize-handle="br"]') as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 50, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 50, clientY: 100, pointerId: 1 });
    const finalWidth = onWidthChange.mock.calls.at(-1)![0];
    expect(finalWidth).toBeGreaterThanOrEqual(40);
  });

  it('shows live WxH badge during drag', () => {
    const r = render(
      <ResizableImage width={200} onWidthChange={() => {}} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    expect(r.container.querySelector('[data-resize-badge]')).toBeNull();
    const wrap = r.container.querySelector('[data-resizable-wrap]') as HTMLElement;
    setRect(wrap, { left: 100, top: 100, width: 200, height: 100 });
    const handle = r.container.querySelector('[data-resize-handle="br"]') as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 360, clientY: 230, pointerId: 1 });
    expect(r.container.querySelector('[data-resize-badge]')).not.toBeNull();
    fireEvent.pointerUp(document, { clientX: 360, clientY: 230, pointerId: 1 });
    expect(r.container.querySelector('[data-resize-badge]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

`npx vitest run tests/unit/ResizableImage.test.tsx`. Expected: FAIL — ResizableImage does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/editor/canvas/ResizableImage.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface ResizableImageProps {
  width: number;
  onWidthChange: (next: number) => void;
  aspectRatio: number;
  minWidth?: number;
  maxWidth?: number;
  children: ReactNode;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const HANDLE_OFFSET = -4;
const DEFAULT_MIN = 40;
const DEFAULT_MAX = 1200;

export function ResizableImage({
  width,
  onWidthChange,
  aspectRatio,
  minWidth = DEFAULT_MIN,
  maxWidth = DEFAULT_MAX,
  children,
}: ResizableImageProps) {
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const startDrag = useCallback(
    (corner: Corner) => (event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const startWidth = rect.width;
      const startX = event.clientX;
      const sign = corner === 'tr' || corner === 'br' ? 1 : -1;

      function clamp(next: number): number {
        return Math.max(minWidth, Math.min(maxWidth, Math.round(next)));
      }

      function onMove(ev: PointerEvent) {
        const delta = (ev.clientX - startX) * sign;
        const next = clamp(startWidth + delta);
        setDragWidth(next);
      }

      function onUp(ev: PointerEvent) {
        const delta = (ev.clientX - startX) * sign;
        const next = clamp(startWidth + delta);
        setDragWidth(null);
        onWidthChange(next);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [maxWidth, minWidth, onWidthChange],
  );

  const displayWidth = dragWidth ?? width;
  const displayHeight = Math.round(displayWidth / aspectRatio);

  return (
    <span
      ref={wrapRef}
      data-resizable-wrap
      className="resizable-image"
      style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}
    >
      {children}
      {(['tl', 'tr', 'bl', 'br'] as Corner[]).map((corner) => (
        <span
          key={corner}
          data-resize-handle={corner}
          onPointerDown={startDrag(corner)}
          className={`resize-handle resize-handle-${corner}`}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            background: 'var(--color-brand)',
            border: '1px solid #fff',
            borderRadius: 2,
            cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
            zIndex: 4,
            ...(corner.startsWith('t') ? { top: HANDLE_OFFSET } : { bottom: HANDLE_OFFSET }),
            ...(corner.endsWith('l') ? { left: HANDLE_OFFSET } : { right: HANDLE_OFFSET }),
          }}
        />
      ))}
      {dragWidth !== null && (
        <span
          data-resize-badge
          className="resize-badge"
          style={{
            position: 'absolute',
            top: -28,
            right: 0,
            background: 'var(--color-ed-panel-2)',
            color: 'var(--color-brand)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid var(--color-ed-rule-strong)',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          {dragWidth} × {displayHeight}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run to verify PASS**

`npx vitest run tests/unit/ResizableImage.test.tsx`. Expected: all 5 tests pass.
`npx tsc --noEmit`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/canvas/ResizableImage.tsx tests/unit/ResizableImage.test.tsx
git commit -m "feat(canvas): ResizableImage component with corner handles"
```

---

## Task 3: Wire ResizableImage into EditableImage

**Files:**
- Modify: `src/components/editor/editable/EditableImage.tsx`

- [ ] **Step 1: Update the component**

Replace the entire body of `src/components/editor/editable/EditableImage.tsx` with:

```tsx
'use client';
import { useAssetPicker } from '../AssetPickerProvider';
import { useEditorMode } from '../EditorModeProvider';
import { ResizableImage } from '../canvas/ResizableImage';
import { EditableText } from './EditableText';

export interface EditableImageProps {
  value: string;
  onChange: (next: string) => void;
  alt: string;
  placeholderLabel: string;
  placeholderWidth?: number;
  placeholderHeight?: number;
  imgStyle?: React.CSSProperties;
  altLabel?: string;
  onAltChange?: (next: string) => void;
  width?: number;
  onWidthChange?: (next: number) => void;
  aspectRatio?: number;
}

export function EditableImage({
  value,
  onChange,
  alt,
  placeholderLabel,
  placeholderWidth,
  placeholderHeight,
  imgStyle,
  altLabel,
  onAltChange,
  width,
  onWidthChange,
  aspectRatio,
}: EditableImageProps) {
  const { openAssetPicker } = useAssetPicker();
  const { mode } = useEditorMode();

  if (mode === 'preview') {
    if (!value) return null;
    const previewStyle: React.CSSProperties = width ? { ...imgStyle, width } : imgStyle ?? {};
    return <img src={value} alt={alt} style={previewStyle} />;
  }

  function open() {
    openAssetPicker({
      value,
      altText: alt,
      onSelect: (url) => onChange(url),
    });
  }

  if (value) {
    const renderedWidth = width;
    const img = (
      <img
        src={value}
        alt={alt}
        onClick={open}
        className="inline-editable-image"
        style={{ cursor: 'pointer', ...(renderedWidth ? { width: renderedWidth } : {}), ...imgStyle }}
      />
    );

    const wrapped = onWidthChange && renderedWidth && aspectRatio
      ? (
        <ResizableImage
          width={renderedWidth}
          onWidthChange={onWidthChange}
          aspectRatio={aspectRatio}
        >
          {img}
        </ResizableImage>
      )
      : img;

    if (!onAltChange) return wrapped;
    return (
      <span className="editable-image-wrap">
        {wrapped}
        <span className="editable-image-alt text-[12px] text-ed-ink-3 px-1">
          Alt:{' '}
          <EditableText
            value={alt}
            onChange={onAltChange}
            singleLine
            placeholder="click to add"
            ariaLabel={altLabel ?? 'Image alt text'}
          />
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={placeholderLabel}
      className="inline-editable-image-placeholder"
      style={{
        width: '100%',
        maxWidth: placeholderWidth ?? 355,
        aspectRatio: placeholderWidth && placeholderHeight
          ? `${placeholderWidth} / ${placeholderHeight}`
          : '4/3',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#eaeaea',
        color: '#888',
        border: '1px dashed #bbb',
        fontSize: 12,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {placeholderLabel}
    </button>
  );
}
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: ALL PASS (no new tests required — existing tests still cover the unchanged paths; the resize wrapper only activates when `onWidthChange`+`width`+`aspectRatio` are ALL provided, which is opt-in).

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/editable/EditableImage.tsx
git commit -m "feat(editable): opt-in ResizableImage wrapper on EditableImage"
```

---

## Task 4: Wire width into ProductSectionView + HeroBlockView + ArticleView

**Files:**
- Modify: `src/components/editor/blocks/ProductSectionView.tsx`
- Modify: `src/components/editor/blocks/HeroBlockView.tsx`
- Modify: `src/components/editor/blocks/ArticleView.tsx`

- [ ] **Step 1: ProductSectionView — pass width through**

In `src/components/editor/blocks/ProductSectionView.tsx`, find the `<EditableImage>` for the section's product image. The current call is something like:

```tsx
<EditableImage
  value={block.imageSrc}
  onChange={(url) => updateBlock(block.id, { imageSrc: url })}
  alt={block.imageAlt}
  placeholderLabel="Click to add product image"
  placeholderWidth={355}
  placeholderHeight={266}
  altLabel="Product image alt text"
  onAltChange={(alt) => updateBlock(block.id, { imageAlt: alt })}
  imgStyle={{ width: '100%', maxWidth: 355, height: 'auto' }}
/>
```

Add the three resize props (`width`, `onWidthChange`, `aspectRatio`). Final form:

```tsx
<EditableImage
  value={block.imageSrc}
  onChange={(url) => updateBlock(block.id, { imageSrc: url })}
  alt={block.imageAlt}
  placeholderLabel="Click to add product image"
  placeholderWidth={355}
  placeholderHeight={266}
  altLabel="Product image alt text"
  onAltChange={(alt) => updateBlock(block.id, { imageAlt: alt })}
  width={block.imageWidth ?? 355}
  onWidthChange={(w) => updateBlock(block.id, { imageWidth: w })}
  aspectRatio={355 / 266}
  imgStyle={{ width: '100%', maxWidth: 355, height: 'auto' }}
/>
```

NOTE: if the actual file has a different existing prop order or uses a different `updateBlock` action name (e.g., `setSection` legacy wrapper), keep that and only ADD the three new props.

- [ ] **Step 2: HeroBlockView — same**

In `src/components/editor/blocks/HeroBlockView.tsx`, find the `<EditableImage>` for the hero image. Add the same three props using hero's default size (likely 710×400 or whatever the existing placeholderWidth/Height is — look at the actual file):

```tsx
width={block.imageWidth ?? 710}
onWidthChange={(w) => updateBlock(block.id, { imageWidth: w })}
aspectRatio={710 / 400}
```

Replace the literal aspect-ratio numbers (`710`, `400`) with whatever the existing `placeholderWidth`/`placeholderHeight` props pass — keep them consistent with that block's existing default.

- [ ] **Step 3: ArticleView — same**

In `src/components/editor/blocks/ArticleView.tsx`, find the `<EditableImage>` for the article image. Add the same three props, using whatever default dimensions match the existing placeholderWidth/Height.

- [ ] **Step 4: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/blocks/ProductSectionView.tsx src/components/editor/blocks/HeroBlockView.tsx src/components/editor/blocks/ArticleView.tsx
git commit -m "feat(canvas): wire resize props on ProductSection/Hero/Article images"
```

---

## Task 5: Wire width into HeaderBlockView (logoWidth) + FooterBlockView (bannerWidth)

**Files:**
- Modify: `src/components/editor/blocks/HeaderBlockView.tsx`
- Modify: `src/components/editor/blocks/FooterBlockView.tsx`

- [ ] **Step 1: HeaderBlockView — logo resize**

Find the `<EditableImage>` for the header logo. Header already stores `logoWidth: number` (NOT optional). Add the resize props:

```tsx
width={block.logoWidth}
onWidthChange={(w) => updateBlock(block.id, { logoWidth: w })}
aspectRatio={block.logoWidth / 80}
```

Adjust the `80` aspect-ratio denominator to match whatever the existing placeholderHeight in this view is (likely ~80; check the file).

The aspect ratio for a logo is tricky because logos vary. Use whatever existing placeholder dimensions the file uses — that's the implicit aspect ratio.

If HeaderBlockView ALSO renders a `bannerSrc` `<EditableImage>`, the banner is full-width and not user-resizable in the existing design — DO NOT add resize props to it. Only the logo.

- [ ] **Step 2: FooterBlockView — banner resize**

Find the `<EditableImage>` for the footer banner. Footer's bannerWidth is the new optional field. Add resize props matching the banner's typical dimensions (check the file's existing `placeholderWidth`/`placeholderHeight`):

```tsx
width={block.bannerWidth ?? 710}
onWidthChange={(w) => updateBlock(block.id, { bannerWidth: w })}
aspectRatio={710 / 120}
```

Match the aspect-ratio numerator/denominator to whatever placeholder dimensions the existing file uses.

- [ ] **Step 3: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/blocks/HeaderBlockView.tsx src/components/editor/blocks/FooterBlockView.tsx
git commit -m "feat(canvas): wire resize props on Header logo and Footer banner"
```

---

## Task 6: Honor width fields in renderEmail.ts + renderPrintDocument.ts + snapshot baselines

**Files:**
- Modify: `src/lib/export/renderEmail.ts`
- Modify: `src/lib/export/renderPrintDocument.ts`
- Modify: `src/lib/export/__fixtures__/baseline-*.html`
- Modify: `src/lib/export/__fixtures__/print-baseline-*.html`
- Test: existing `tests/unit/renderPrintDocument.test.ts` should still pass

- [ ] **Step 1: renderEmail.ts — apply width on `<img>` style**

Open `src/lib/export/renderEmail.ts`. Find the product-section image `<img>` (search for `block.imageSrc`). The current output style includes `max-width: 100%` etc. Add a `width: ${block.imageWidth}px;` segment IF `block.imageWidth` is defined.

Pattern (apply to each block-type render function that emits an image — ProductSection, Hero, Article, Footer banner; Header logo already uses `logoWidth`):

```ts
const widthStyle = block.imageWidth ? `width: ${block.imageWidth}px;` : '';
// ...inside the img tag style attribute:
style="display: block; max-width: 100%; height: auto; ${widthStyle}"
```

For FooterBlock use `block.bannerWidth` and the matching CSS attribute.

For HeaderBlock, the existing `width="${block.logoWidth}"` attribute is already correct — no change.

- [ ] **Step 2: renderPrintDocument.ts — apply width**

Open `src/lib/export/renderPrintDocument.ts`. Apply the same pattern to each render function:

`renderProductSectionForPrint` — when emitting `<img>` for the image column, add the same `widthStyle` snippet to the style attribute.

`renderHeroForPrint` — same.

`renderArticleForPrint` — same.

`renderFooterForPrint` — `block.bannerWidth` if defined.

`renderHeaderForPrint` — already uses `logoWidth` via the `width="${logoWidth}"` HTML attribute. No change needed.

- [ ] **Step 3: Regenerate baselines**

```bash
npx tsx scripts/capture-render-baseline.ts
```

Verify with `git status` — the 5 email baselines + 5 print baselines may or may not change (they will NOT change because no template assigns imageWidth — but the conditional emit must be inert in that case; if any baseline drifts, the conditional is wrong and you must fix it).

If baselines are byte-identical to before this task, great. If they drift, that's a bug in your conditional — only emit the width snippet when `block.imageWidth` (or `bannerWidth`) is truthy.

- [ ] **Step 4: Run all tests**

`npx tsc --noEmit && npx vitest run`. Expected: ALL PASS (snapshot tests should still pass since no template defaults set width).

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/renderEmail.ts src/lib/export/renderPrintDocument.ts
git commit -m "feat(export): honor block image width fields in email + print render"
```

---

## Task 7: Asset Picker — modal shell restyle

**Files:**
- Modify: `src/components/editor/AssetPicker.tsx`

- [ ] **Step 1: Restyle the outer modal shell + header + footer**

In `src/components/editor/AssetPicker.tsx`, find the return JSX (around line 147). Replace the outer `<div>` and the header/footer regions ONLY (not the tab row, not the body content) so the structure becomes:

The OUTER wrapper (line 148 area) currently uses `bg-black/70 p-4 backdrop-blur-sm` + a `max-w-5xl rounded-xl border border-ed-rule bg-ed-panel-2 shadow-...` card. Tighten this to:

```tsx
return (
  <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-8 backdrop-blur-sm">
    <div className="flex h-full w-full max-w-[1024px] flex-col overflow-hidden rounded-[12px] border border-ed-rule bg-ed-panel-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-ed-rule px-4 py-3">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-ed-ink">Asset Picker</div>
          <div className="text-xs text-ed-ink-3">Workspace library, uploads, and AI generation in one place.</div>
        </div>
        <button
          type="button"
          aria-label="Close asset picker"
          className="rounded-md p-1.5 text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* TAB ROW — keep existing logic, see Task 8 for restyle */}
      <div className="flex gap-2 border-b border-ed-rule px-4 py-3">
        <TabButton active={tab === 'library'} onClick={() => setTab('library')}>Library</TabButton>
        <TabButton active={tab === 'upload'} disabled={!canEdit} onClick={() => setTab('upload')}>Upload</TabButton>
        <TabButton active={tab === 'generate'} disabled={!canEdit} onClick={() => setTab('generate')}>Generate</TabButton>
        {editingAsset && <TabButton active={tab === 'edit'} disabled={!canEdit} onClick={() => setTab('edit')}>Edit</TabButton>}
        {editingAsset && <TabButton active={tab === 'chat'} disabled={!canEdit} onClick={() => setTab('chat')}>Chat refine</TabButton>}
      </div>

      {/* BODY — keep existing tab switch as-is for this task */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ...existing tab body content unchanged... */}
      </div>

      {/* FOOTER */}
      <div className="border-t border-ed-rule px-4 py-3 text-xs text-ed-ink-3">
        {usage ? `Quota: ${usage.count}/${usage.limit} this month` : 'Quota unavailable'}
      </div>
    </div>
  </div>
);
```

Keep the existing tab-body switch (`{tab === 'library' && ...}` etc.) INSIDE the body region — do not modify it in this task. Only the outer shell + header + footer change.

- [ ] **Step 2: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/AssetPicker.tsx
git commit -m "fix(asset-picker): restyle modal shell with refined header + footer"
```

---

## Task 8: Asset Picker — tab pills restyle

**Files:**
- Modify: `src/components/editor/AssetPicker.tsx`

- [ ] **Step 1: Restyle the inline TabButton component**

In `src/components/editor/AssetPicker.tsx`, find the `TabButton` function at the bottom of the file. Replace its body so the active state is a solid brand pill and inactive is a subtle panel-3 pill:

```tsx
function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick(): void;
  children: import('react').ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? 'bg-brand text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]'
          : 'bg-ed-panel-3 text-ed-ink hover:bg-ed-panel hover:text-ed-ink'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
```

Changes from before: `py-2` → `py-1.5`, `text-sm` → `text-[13px] font-medium`, added inset highlight on active pill, added hover state on inactive.

- [ ] **Step 2: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/AssetPicker.tsx
git commit -m "fix(asset-picker): refined tab pill visual treatment"
```

---

## Task 9: Asset Picker — Library tab body restyle

**Files:**
- Modify: `src/components/editor/AssetPicker.tsx`
- Modify: `src/components/editor/AssetLibraryGrid.tsx`

- [ ] **Step 1: Add search icon to the search row**

In `src/components/editor/AssetPicker.tsx`, find the Library tab body (line ~169). Update the search row:

```tsx
{tab === 'library' && (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ed-ink-3" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by alt text, prompt, or filename"
          className="pl-9"
        />
      </div>
      {selectedPreview && (
        <img
          src={selectedPreview}
          alt=""
          className="h-10 w-10 shrink-0 rounded-md border border-ed-rule-strong object-cover"
        />
      )}
    </div>
    {loading ? (
      <div className="flex items-center gap-2 text-sm text-ed-ink-3">
        <Spinner size={16} /> Loading assets…
      </div>
    ) : (
      <AssetLibraryGrid
        assets={assets}
        canEdit={canEdit}
        onUse={(asset) => onSelect(asset.url)}
        onArchive={onArchive}
        onEdit={(asset) => {
          setEditingAsset(asset);
          setEditPrompt(asset.prompt ?? '');
          setTab('edit');
        }}
        onChatRefine={(asset) => {
          setEditingAsset(asset);
          setTab('chat');
        }}
        onRemoveBg={(asset) => {
          setEditingAsset(asset);
          setEditPrompt('remove the background, output transparent PNG');
          void onRunEdit('remove_bg', asset);
        }}
      />
    )}
  </div>
)}
```

Add `Search` to the lucide imports at the top of the file (`import { X, Search } from 'lucide-react';`).

- [ ] **Step 2: Restyle grid cards**

Replace the body of `src/components/editor/AssetLibraryGrid.tsx` with:

```tsx
'use client';

import type { WorkspaceAsset } from '@/lib/api/assets';
import { Button } from '@/components/ui/Button';

interface Props {
  assets: WorkspaceAsset[];
  canEdit: boolean;
  onUse(asset: WorkspaceAsset): void;
  onArchive(asset: WorkspaceAsset): void;
  onEdit(asset: WorkspaceAsset): void;
  onChatRefine(asset: WorkspaceAsset): void;
  onRemoveBg(asset: WorkspaceAsset): void;
}

export function AssetLibraryGrid({
  assets,
  canEdit,
  onUse,
  onArchive,
  onEdit,
  onChatRefine,
  onRemoveBg,
}: Props) {
  if (assets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ed-rule-strong p-12 text-center text-sm text-ed-ink-3">
        No assets yet. Upload or generate one to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="group overflow-hidden rounded-lg border border-ed-rule-strong bg-ed-panel-2 transition-colors hover:border-brand/40"
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-ed-panel">
            <img
              src={asset.url}
              alt={asset.alt_text ?? ''}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="space-y-2 p-3">
            <div className="space-y-1">
              <div className="truncate text-[12px] font-medium text-ed-ink">
                {asset.original_filename || asset.prompt || `${asset.source} image`}
              </div>
              <div className="line-clamp-2 text-[11px] text-ed-ink-3">
                {asset.alt_text || asset.prompt || asset.source}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="secondary"
                className="min-h-8 rounded-md bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand hover:bg-brand/25 hover:text-brand"
                onClick={() => onUse(asset)}
              >
                Use
              </Button>
              {canEdit && (
                <>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-[11px]" onClick={() => onEdit(asset)}>
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-[11px]" onClick={() => onChatRefine(asset)}>
                    Chat refine
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-[11px]" onClick={() => onRemoveBg(asset)}>
                    Remove BG
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-8 px-2 py-1 text-[11px] text-danger hover:text-danger"
                    onClick={() => onArchive(asset)}
                  >
                    Archive
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Key visual changes from the original: card uses `rounded-lg`, image is in an aspect-ratio container instead of fixed height, hover border becomes brand/40, "Use" button is a brand-tinted secondary (not the standard secondary), text sizes tightened.

- [ ] **Step 3: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/AssetPicker.tsx src/components/editor/AssetLibraryGrid.tsx
git commit -m "fix(asset-picker): library tab — search icon + refined grid cards"
```

---

## Task 10: Asset Picker — Upload tab body restyle

**Files:**
- Modify: `src/components/editor/AssetPicker.tsx`

- [ ] **Step 1: Replace the Upload tab body**

In `src/components/editor/AssetPicker.tsx`, find the Upload tab body (line ~207 area). Replace with a larger, more inviting dropzone:

```tsx
{tab === 'upload' && (
  <div className="flex h-full items-center justify-center">
    <div
      role="button"
      tabIndex={0}
      onClick={() => uploadRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          uploadRef.current?.click();
        }
      }}
      className="flex w-full max-w-xl cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed border-ed-rule-strong bg-ed-panel-2 px-8 py-14 text-center transition-colors hover:border-brand"
    >
      <UploadCloud size={40} className="text-ed-ink-3" strokeWidth={1.5} />
      <div className="space-y-1">
        <div className="text-base font-medium text-ed-ink">
          {uploadBusy ? 'Uploading…' : 'Drop an image here, or click to browse'}
        </div>
        <div className="text-xs text-ed-ink-3">PNG, JPG, WebP, or GIF. Max 10 MB.</div>
      </div>
      <span className="rounded-md border border-brand bg-brand/15 px-4 py-2 text-[13px] font-medium text-brand">
        Choose file
      </span>
    </div>
    <input
      ref={uploadRef}
      type="file"
      hidden
      accept="image/png,image/jpeg,image/webp,image/gif"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void onUpload(file);
      }}
    />
  </div>
)}
```

Add `UploadCloud` to the lucide imports at the top of the file (`import { X, Search, UploadCloud } from 'lucide-react';`).

- [ ] **Step 2: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/AssetPicker.tsx
git commit -m "fix(asset-picker): upload tab — larger dashed dropzone with icon"
```

---

## Task 11: Asset Picker — Generate tab restyle (GenerateImageForm)

**Files:**
- Modify: `src/components/editor/GenerateImageForm.tsx`

- [ ] **Step 1: Restyle the form**

Open `src/components/editor/GenerateImageForm.tsx`. Replace the return JSX (the entire `return (...)` block) with:

```tsx
return (
  <div className="space-y-4">
    {/* Prompt */}
    <Textarea
      rows={4}
      value={prompt}
      onChange={(event) => setPrompt(event.target.value)}
      placeholder="Describe the image you want to create..."
      disabled={!canEdit || busy}
      className="text-[13px]"
    />

    {/* References */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ed-ink-3">
          Reference images (optional)
        </div>
        <div className="text-[11px] text-ed-ink-3">{references.length}/{MAX_REFERENCES}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {references.map((ref) => (
          <div
            key={ref.assetId}
            className="relative h-16 w-16 overflow-hidden rounded-md border border-ed-rule-strong bg-ed-panel-2"
          >
            <img src={ref.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemoveReference(ref.assetId)}
              disabled={busy}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 disabled:opacity-50"
              aria-label="Remove reference"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {references.length < MAX_REFERENCES && (
          <button
            type="button"
            onClick={() => refInputRef.current?.click()}
            disabled={!canEdit || busy || refUploadBusy}
            className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-ed-rule-strong bg-ed-panel-2 text-[11px] text-ed-ink-3 hover:border-brand hover:text-ed-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {refUploadBusy ? <Spinner size={14} /> : '+ Add'}
          </button>
        )}
      </div>
      <input
        ref={refInputRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onAddReference(file);
        }}
      />
      {references.length > 0 && (
        <div className="text-[11px] text-ed-ink-3">References guide the style or subject of the output.</div>
      )}
    </div>

    {/* Aspect ratio + variant count */}
    <div className="grid grid-cols-2 gap-2">
      <Select
        value={aspectRatio}
        onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)}
        disabled={!canEdit || busy}
      >
        <option value="1:1">1:1</option>
        <option value="16:9">16:9</option>
        <option value="9:16">9:16</option>
        <option value="4:3">4:3</option>
      </Select>
      <Select
        value={String(count)}
        onChange={(event) => setCount(Number(event.target.value) as 1 | 2 | 4)}
        disabled={!canEdit || busy}
      >
        <option value="1">1 variant</option>
        <option value="2">2 variants</option>
        <option value="4">4 variants</option>
      </Select>
    </div>

    {/* Google Search */}
    <label className="flex items-start gap-2 rounded-md border border-ed-rule bg-ed-panel/40 px-3 py-2 text-[12px] text-ed-ink">
      <input
        type="checkbox"
        checked={useGoogleSearch}
        onChange={(event) => setUseGoogleSearch(event.target.checked)}
        disabled={!canEdit || busy}
        className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-brand"
      />
      <span>
        <span className="font-medium">Use Google Search</span>
        <span className="ml-1 text-ed-ink-3">— ground in web + image search results (slower; great for current events, brands, real places).</span>
      </span>
    </label>

    {/* Primary CTA */}
    <Button
      type="button"
      variant="primary"
      onClick={onSubmit}
      disabled={!canEdit || busy || !prompt.trim()}
      className="w-full bg-brand text-white hover:bg-brand-ink"
    >
      {busy ? <><Spinner size={14} /> Generating {elapsed > 0 ? `(${elapsed}s)` : ''}</> : 'Generate'}
    </Button>
    {error && <div className="text-[11px] text-danger">{error}</div>}

    {/* Results */}
    {assets.length > 0 && (
      <div className="space-y-2 pt-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ed-ink-3">Results</div>
        <div className="grid grid-cols-2 gap-3">
          {assets.map((asset) => (
            <button
              key={asset.assetId}
              type="button"
              className="group overflow-hidden rounded-lg border border-ed-rule-strong bg-ed-panel-2 text-left transition-colors hover:border-brand/50"
              onClick={() => onUse(asset)}
            >
              <div className="aspect-[16/10] overflow-hidden bg-ed-panel">
                <img src={asset.url} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="px-3 py-2 text-[11px] font-medium text-ed-ink-3 group-hover:text-brand">Use image →</div>
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);
```

NOTE: If the existing `Button` component does not accept a `"primary"` variant, use `"secondary"` and rely on the inline `className="w-full bg-brand text-white hover:bg-brand-ink"` to override. Verify by reading `src/components/ui/Button.tsx` if needed.

- [ ] **Step 2: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/GenerateImageForm.tsx
git commit -m "fix(asset-picker): generate tab — refined prompt, references, results"
```

---

## Task 12: Asset Picker — Edit + Chat tab body polish

**Files:**
- Modify: `src/components/editor/AssetPicker.tsx`

- [ ] **Step 1: Restyle the Edit tab body**

In `src/components/editor/AssetPicker.tsx`, find the Edit tab body (the `{tab === 'edit' && editingAsset && (...)` block, line ~259). Replace it with:

```tsx
{tab === 'edit' && editingAsset && (
  <div className="space-y-4">
    <div className="overflow-hidden rounded-lg border border-ed-rule-strong bg-ed-panel">
      <MaskCanvas ref={maskRef} imageUrl={editingAsset.url} />
    </div>
    <Textarea
      rows={3}
      value={editPrompt}
      onChange={(event) => setEditPrompt(event.target.value)}
      placeholder="Describe how the masked area should change..."
      disabled={!canEdit || editBusy}
      className="text-[13px]"
    />
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        className="bg-brand text-white hover:bg-brand-ink"
        onClick={() => void onRunEdit('inpaint')}
        disabled={!canEdit || editBusy || !editPrompt.trim()}
      >
        {editBusy ? 'Processing…' : 'Regenerate masked area'}
      </Button>
      <Button type="button" variant="ghost" onClick={() => maskRef.current?.clear()} disabled={editBusy}>
        Clear mask
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setEditingAsset(null);
          setTab('library');
        }}
      >
        Back to library
      </Button>
    </div>
  </div>
)}
```

The Chat refine tab (`{tab === 'chat' && editingAsset && <ChatRefinePanel ... />}`) does not need changes here since ChatRefinePanel is a separate file — leave it alone for now.

- [ ] **Step 2: Verify**

`npx tsc --noEmit && npx vitest run`. Expected: clean.

- [ ] **Step 3: Final smoke**

Manual smoke checklist (to be performed by the merger):
1. Open the asset picker in the editor by clicking any image. Verify the modal opens with a refined warm-dark shell.
2. Click each tab (Library / Upload / Generate / Edit / Chat refine) — visual states match the Stitch references; active tab is brand-filled, inactive tabs are panel-3.
3. In Library: type into search → see icon; hover an asset card → border lights up brand-soft; click Use → modal closes and image swaps in canvas.
4. In Upload: dropzone hover → border becomes brand; click → file picker opens.
5. In Generate: prompt textarea + reference upload + aspect/count selects + Google Search checkbox + Generate button + result grid all visible and functional. Generate button is brand-orange filled.
6. In edit mode on canvas: click a product image → 4 brand-orange corner handles appear at the image corners; drag the bottom-right handle → image resizes with a live `WxH` badge; release → width persists; toggle to preview → image renders at the new width.
7. Toggle preview mode → asset picker affordances should not be reachable.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/AssetPicker.tsx
git commit -m "fix(asset-picker): edit tab — refined mask canvas frame + button hierarchy"
```

---

## Self-review notes

Spec coverage: ✅ Stitch references for Library/Upload/Generate covered in Tasks 7/8/9/10/11. Edit tab covered in Task 12. Image resize covered in Tasks 1/2/3/4/5/6. Existing features preserved (no signature changes, no removed code paths). No new runtime deps introduced.

Placeholder scan: ✅ No "TBD", "TODO", "implement later" anywhere. All code blocks contain real code an engineer can paste.

Type consistency: ✅ `imageWidth?: number` used consistently across blocks (Task 1) and threaded through props (Tasks 3/4) and exports (Task 6). `bannerWidth?: number` on FooterBlock is the equivalent for the footer banner.
