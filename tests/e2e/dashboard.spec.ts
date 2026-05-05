import { expect, test } from '@playwright/test';

test.skip(
  !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
  'Set E2E_EMAIL and E2E_PASSWORD in .env.local to run dashboard E2E.',
);

test('login, create, rename, delete a project', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  const initialCount = await page.getByText(/Updated/).count();

  await page.getByRole('button', { name: /new project/i }).click();
  await expect(page).toHaveURL(/\/p\//);

  await page.goto('/');
  await expect(page.getByText(/Updated/)).toHaveCount(initialCount + 1);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expect(page.getByText(/Updated/)).toHaveCount(initialCount);
});
