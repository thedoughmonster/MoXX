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
    await page.goto(`/checkout/reference?scenario=${scenario}`);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Totals and holds' })).toBeVisible();
  });
}

test('supports keyboard checkout progression through payment confirmation', async ({ page }) => {
  await page.goto('/checkout/reference');
  await page.getByLabel('Name').fill('Synthetic Customer');
  await page.getByLabel('Email').fill('customer@example.invalid');
  await page.getByLabel(/Confirm this fulfillment selection/).check();
  await page.getByRole('button', { name: 'Save contact details' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Payment is required' })).toBeFocused();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment is pending' })).toBeFocused();
  await page.getByRole('button', { name: 'Refresh checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0);
});

test('retries fulfillment failure using the saved version and latest owner reference', async ({ page }) => {
  await page.goto('/checkout/reference?failure=fulfillment-once');
  await page.getByLabel('Name').fill('Synthetic Customer');
  await page.getByLabel('Email').fill('customer@example.invalid');
  await page.getByLabel(/Confirm this fulfillment selection/).check();
  await page.getByRole('button', { name: 'Save contact details' }).click();
  await expect(page.getByRole('alert')).toContainText('could not complete that action');
  await expect(page.locator('.checkout-reference')).toContainText('version 4');
  await expect(page.getByLabel('Name')).toHaveValue('Synthetic Customer');
  await page.getByRole('button', { name: 'Save contact details' }).click();
  await expect(page.getByRole('heading', { name: 'Payment is required' })).toBeFocused();
  await expect(page.locator('.checkout-reference')).toContainText('version 6');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('keeps the standalone pending scenario pending on refresh', async ({ page }) => {
  await page.goto('/checkout/reference?scenario=pending');
  await page.getByRole('button', { name: 'Refresh checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Payment is pending' })).toBeFocused();
});

test('reflows at 200 percent zoom without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/checkout/reference?scenario=declined');
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const button = page.getByRole('button', { name: 'Try another payment' });
  const box = await button.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);
});

test('keeps synthetic authority on the explicit reference route', async ({ page }) => {
  await page.goto('/checkout?order_id=60000000-0000-4000-8000-000000000001&order_version=3&shopping_authority_id=60000000-0000-4000-8000-000000000003&scenario=confirmed');
  await expect(page.getByRole('heading', { name: 'Checkout is not connected' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toHaveCount(0);
});

test('announces a load rejection and provides an operable retry', async ({ page }) => {
  await page.goto('/checkout/reference?scenario=ready&failure=load-once');
  await expect(page.getByRole('alert')).toContainText('Checkout is unavailable');
  await page.getByRole('button', { name: 'Try loading again' }).click();
  await expect(page.getByRole('heading', { name: 'Payment is required' })).toBeFocused();
});

test('announces an action rejection and permits retry', async ({ page }) => {
  await page.goto('/checkout/reference?scenario=ready&failure=command-once');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByRole('alert')).toContainText('could not complete that action');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment is pending' })).toBeFocused();
});
