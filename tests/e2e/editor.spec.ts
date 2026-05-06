import { test, expect } from '@playwright/test';

test.skip(
  !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
  'Set E2E_EMAIL and E2E_PASSWORD in .env.local to run editor E2E.',
);

test('open project, edit a section title, autosave, reload, persists', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('button', { name: /new project/i }).click();
  await expect(page).toHaveURL(/\/p\//);

  await page.getByRole('button', { name: /Starlink Solutions/ }).first().click();
  const titleField = page.locator('input[value="Starlink Solutions"]').first();
  await titleField.fill('My Custom Title');

  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5000 });

  await page.reload();
  await expect(page.locator('input[value="My Custom Title"]')).toBeVisible();
});
