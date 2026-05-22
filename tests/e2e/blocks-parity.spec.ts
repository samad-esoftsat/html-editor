import { test, expect, type Page } from '@playwright/test';

/**
 * Edit-vs-preview parity: a block must occupy the same horizontal footprint
 * in edit and preview modes. Edit chrome (toolbars, insert bars, contenteditable)
 * may change height, but width drift is a fidelity bug — for example, the CTA
 * stretching to full column width because of flex `align-items: stretch`.
 *
 * Tolerance: 2px. Anything larger means the rendered geometry differs between
 * the user's editing context and what we'll actually ship.
 */

const TOLERANCE_PX = 2;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function collectBoxes(page: Page, selector: string): Promise<Box[]> {
  return page.$$eval(selector, (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

async function openGallery(page: Page, mode: 'edit' | 'preview'): Promise<void> {
  await page.goto(`/dev/blocks?mode=${mode}`);
  await page.waitForSelector('#blocks-gallery');
  await page.waitForFunction(() => document.fonts.ready.then(() => true), null, { timeout: 5000 });
}

test.describe('Block geometry parity (edit vs preview)', () => {
  test('section-wrap widths match across modes', async ({ page }) => {
    await openGallery(page, 'edit');
    const editBoxes = await collectBoxes(page, '.section-wrap');

    await openGallery(page, 'preview');
    const previewBoxes = await collectBoxes(page, '.section-wrap');

    expect(previewBoxes.length).toBe(editBoxes.length);
    for (let i = 0; i < editBoxes.length; i++) {
      const delta = Math.abs(editBoxes[i].width - previewBoxes[i].width);
      expect(delta, `section-wrap[${i}] width drifted ${delta}px between modes`).toBeLessThanOrEqual(
        TOLERANCE_PX,
      );
    }
  });

  test('cta-edit-anchor widths match across modes', async ({ page }) => {
    await openGallery(page, 'edit');
    const editBoxes = await collectBoxes(page, '.cta-edit-anchor');

    await openGallery(page, 'preview');
    const previewBoxes = await collectBoxes(page, '.cta-edit-anchor');

    expect(previewBoxes.length).toBe(editBoxes.length);
    for (let i = 0; i < editBoxes.length; i++) {
      const delta = Math.abs(editBoxes[i].width - previewBoxes[i].width);
      expect(delta, `cta-edit-anchor[${i}] width drifted ${delta}px between modes`).toBeLessThanOrEqual(
        TOLERANCE_PX,
      );
    }
  });

  test('section image widths match across modes', async ({ page }) => {
    await openGallery(page, 'edit');
    const editBoxes = await collectBoxes(page, '.section-wrap img');

    await openGallery(page, 'preview');
    const previewBoxes = await collectBoxes(page, '.section-wrap img');

    expect(previewBoxes.length).toBe(editBoxes.length);
    for (let i = 0; i < editBoxes.length; i++) {
      const delta = Math.abs(editBoxes[i].width - previewBoxes[i].width);
      expect(delta, `section image[${i}] width drifted ${delta}px between modes`).toBeLessThanOrEqual(
        TOLERANCE_PX,
      );
    }
  });
});

test.describe('Block snapshot baselines', () => {
  // Pixel-snapshot the whole gallery once per mode. If anything moves, CI prints
  // a diff and offers to update via `npx playwright test --update-snapshots`.
  for (const mode of ['edit', 'preview'] as const) {
    test(`gallery — ${mode}`, async ({ page }) => {
      await openGallery(page, mode);
      // Hide any blinking carets / hover affordances before snapshotting.
      await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
      await expect(page.locator('#blocks-gallery')).toHaveScreenshot(`gallery-${mode}.png`, {
        maxDiffPixelRatio: 0.005,
      });
    });
  }
});
