import { test, expect } from '@playwright/test';

test.skip(
  !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
  'Set E2E_EMAIL and E2E_PASSWORD in .env.local to run asset picker E2E.',
);

test('asset picker opens from a header image field', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('button', { name: /new project/i }).click();
  await expect(page).toHaveURL(/\/p\//);

  await page.getByRole('button', { name: /header/i }).click();
  await page.getByText(/choose image|change image|browse assets/i).first().click();
  await expect(page.getByText(/asset picker/i)).toBeVisible();
});
