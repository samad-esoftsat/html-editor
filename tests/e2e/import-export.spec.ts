import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test.skip(
  !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
  'Set E2E_EMAIL and E2E_PASSWORD in .env.local to run round-trip E2E.',
);

test('export the default project and round-trip via import', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('button', { name: /new project/i }).click();
  await expect(page).toHaveURL(/\/p\//);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /download html/i }).click();
  const download = await downloadPromise;
  const tmp = resolve(__dirname, `_tmp-${Date.now()}.html`);
  await download.saveAs(tmp);

  await page.goto('/');
  await page.getByRole('button', { name: /import html/i }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(tmp);
  await expect(page.getByText(/8 product sections/)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /open in editor/i }).click();
  await expect(page).toHaveURL(/\/p\//);
  await expect(page.getByRole('button', { name: /Starlink Solutions/ })).toBeVisible();
});
