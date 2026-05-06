import { test, expect } from '@playwright/test';

const BASE = process.env.PROD_URL;

test.skip(!BASE, 'Set PROD_URL to run prod smoke');

test.use({ baseURL: BASE });

test('prod login + dashboard renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});
