import { expect, test } from '@playwright/test';

test.skip(process.env.MOXI_E2E_MODE === 'toast_handoff', 'first-party fixture suite');

const states = [
  ['loading', 'Loading checkout'],
  ['empty', 'Your cart is empty'],
  ['incomplete', 'Checkout needs information'],
  ['ready', 'Payment is required'],
  ['invalid', 'Checkout needs attention'],
  ['stale', 'Checkout changed'],
  ['pending', 'Payment is pending'],
  ['declined', 'Payment was declined'],
  ['indeterminate', 'Payment status is uncertain'],
  ['recovery', 'Recovery is required'],
  ['confirmed', 'Order confirmed']
] as const;

for (const [scenario, heading] of states) {
  test(`renders the ${scenario} contract fixture`, async ({ page }) => {
    await page.goto(`/checkout?scenario=${scenario}`);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Totals and holds' })).toBeVisible();
  });
}

test('supports keyboard contact and fulfillment progression', async ({ page }) => {
  await page.goto('/checkout?scenario=incomplete');
  await page.getByLabel('Name').fill('Synthetic Customer');
  await page.getByLabel('Email').fill('customer@example.invalid');
  await page.getByLabel(/Confirm this fulfillment selection/).check();
  await page.getByRole('button', { name: 'Save contact details' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Payment is required' })).toBeFocused();
});

test('reflows at 200 percent zoom without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/checkout?scenario=declined');
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const button = page.getByRole('button', { name: 'Try another payment' });
  const box = await button.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);
});
