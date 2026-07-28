import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pick your doughnuts.' })).toBeVisible();
});

test('supports fulfillment, allergen, cart, and review interactions', async ({ page }) => {
  await page.locator('.date-card').filter({ hasText: 'More room' }).click();
  await expect(page.getByText('Sunday, Aug 2 · 9:00–10:00 AM').first()).toBeVisible();

  await page.locator('.allergen-chip').filter({ hasText: 'Milk' }).click();
  const strawberryCard = page.getByRole('article').filter({ hasText: 'Strawberry Cloud' });
  await expect(strawberryCard.getByText('Contains Milk')).toBeVisible();
  await expect(strawberryCard.getByRole('button', { name: 'Add one Strawberry Cloud' }))
    .toBeDisabled();

  await page.getByRole('button', { name: 'Clear all' }).click();
  const addStrawberry = strawberryCard.getByRole('button', { name: 'Add one Strawberry Cloud' });
  await addStrawberry.focus();
  await page.keyboard.press('Enter');
  await expect(strawberryCard.getByLabel('1 selected')).toHaveText('1');
  await expect(page.getByRole('heading', { name: '1 doughnut' })).toBeVisible();
  await expect(page.getByText('$4.50').last()).toBeVisible();

  await page.getByRole('button', { name: /Review preorder/ }).click();
  await expect(page.getByRole('heading', { name: 'Your draft is ready for a fresh quote.' }))
    .toBeVisible();
  await page.getByRole('button', { name: '← Keep shopping' }).click();
  await expect(strawberryCard.getByLabel('1 selected')).toHaveText('1');
});

test('keeps every quantity control at least 48 by 48 CSS pixels', async ({ page }) => {
  const buttons = page.locator('.stepper-button');
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    const box = await buttons.nth(index).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(48);
    expect(box?.height).toBeGreaterThanOrEqual(48);
  }
});

test('does not let the cart cover the ordering controls', async ({ page }) => {
  const addButton = page.getByRole('button', { name: 'Add one Strawberry Cloud' });
  await addButton.scrollIntoViewIfNeeded();
  const buttonBox = await addButton.boundingBox();
  const cartBox = await page.locator('.cart-summary').boundingBox();

  expect(buttonBox).not.toBeNull();
  expect(cartBox).not.toBeNull();
  if (buttonBox && cartBox) {
    const overlapsHorizontally = buttonBox.x < cartBox.x + cartBox.width
      && buttonBox.x + buttonBox.width > cartBox.x;
    const overlapsVertically = buttonBox.y < cartBox.y + cartBox.height
      && buttonBox.y + buttonBox.height > cartBox.y;
    const overlaps = overlapsHorizontally && overlapsVertically;
    expect(overlaps).toBe(false);
  }

  if ((page.viewportSize()?.width ?? 0) <= 1020) {
    const lastProductBox = await page.getByRole('article').last().boundingBox();
    expect(lastProductBox).not.toBeNull();
    if (lastProductBox && cartBox) {
      expect(cartBox.y).toBeGreaterThanOrEqual(lastProductBox.y + lastProductBox.height);
    }
  }
});
