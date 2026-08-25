import { expect, test } from '@playwright/test';

test.skip(process.env.MOXI_E2E_MODE !== 'toast_handoff', 'operational handoff suite');

test('offers a real, accessible checkout handoff', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {
    name: 'Your Dough Monster order starts here.'
  })).toBeVisible();
  await expect(page.getByLabel('Online ordering available')).toBeVisible();

  const checkout = page.getByRole('link', { name: 'Start your order' });
  await expect(checkout).toHaveAttribute(
    'href',
    'https://www.toasttab.com/local/order/dough-monster'
  );
  const box = await checkout.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);
});

test('keeps the order action visible at the required viewport', async ({ page }) => {
  await page.goto('/');
  const action = page.getByRole('link', { name: 'Start your order' });
  await expect(action).toBeInViewport();
});
