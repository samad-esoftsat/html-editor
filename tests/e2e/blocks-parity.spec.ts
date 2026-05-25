import { test, expect } from '@playwright/test';

async function openGallery(page: import('@playwright/test').Page, mode: 'edit' | 'preview') {
  await page.goto(`/dev/blocks?mode=${mode}`);
  await page.waitForSelector('#blocks-gallery');
}

test.describe('Craft gallery smoke', () => {
  for (const mode of ['edit', 'preview'] as const) {
    test(`gallery renders in ${mode} mode`, async ({ page }) => {
      await openGallery(page, mode);
      await expect(page.locator('#blocks-gallery')).toBeVisible();
      await expect(page.locator('#blocks-gallery')).toHaveScreenshot(`gallery-${mode}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
