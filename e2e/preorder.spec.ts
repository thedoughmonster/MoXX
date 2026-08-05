import { expect, test } from '@playwright/test';

test.skip(process.env.MOXI_E2E_MODE === 'toast_handoff', 'first-party fixture suite');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Preview menu · Test data only')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick your doughnuts.' })).toBeVisible();
});

test('supports fulfillment, allergen, cart, and review interactions', async ({ page }) => {
  await page.locator('.date-card').filter({ hasText: 'More room' }).click();
  await expect(page.getByText('Sunday, Aug 2 · 9:00–10:00 AM').first()).toBeVisible();

  await page.locator('.allergen-chip').filter({ hasText: 'Milk' }).click();
  const strawberryCard = page.getByRole('article').filter({ hasText: 'Strawberry Cloud' });
  await expect(strawberryCard.getByText('Conflicts with Milk')).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Who’s picking up?' })).toBeVisible();
  await page.getByLabel('Pickup name').fill('Zac Monster');
  await page.getByLabel('Email').fill('zac@example.test');
  await page.getByLabel('Mobile phone').fill('562-555-0100');
  await page.getByRole('button', { name: 'Review preorder →' }).click();
  await expect(page.getByRole('heading', { name: 'Review your preorder' })).toBeVisible();
  await expect(page.getByText('Fresh authoritative quote required')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secure checkout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secure payment' })).toBeVisible();
  await expect(page.getByText('Payment will appear after the preorder menu is published.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit payment' })).toHaveCount(0);
  await expect(page.getByText('Ordering remains disabled')).toBeVisible();
  await page.getByRole('button', { name: '← Edit details' }).click();
  await expect(page.getByLabel('Pickup name')).toHaveValue('Zac Monster');
  await page.getByRole('button', { name: '← Keep shopping' }).click();
  await expect(strawberryCard.getByLabel('1 selected')).toHaveText('1');
});

test('restores a bounded draft and requires revalidation', async ({ page }) => {
  const strawberryCard = page.getByRole('article').filter({ hasText: 'Strawberry Cloud' });
  await strawberryCard.getByRole('button', { name: 'Add one Strawberry Cloud' }).click();
  await page.getByRole('button', { name: /Review preorder/ }).click();
  await page.getByLabel('Pickup name').fill('Lydia Monster');
  await page.getByLabel('Email').fill('lydia@example.test');
  await page.getByLabel('Mobile phone').fill('562-555-0111');
  await page.reload();
  await expect(
    page.getByText('Draft restored and revalidated against the current preview menu'),
  ).toBeVisible();
  await expect(strawberryCard.getByLabel('1 selected')).toHaveText('1');
  await page.getByRole('button', { name: /Review preorder/ }).click();
  await expect(page.getByLabel('Pickup name')).toHaveValue('Lydia Monster');
});

test('shows field errors without creating an order', async ({ page }) => {
  const strawberryCard = page.getByRole('article').filter({ hasText: 'Strawberry Cloud' });
  await strawberryCard.getByRole('button', { name: 'Add one Strawberry Cloud' }).click();
  await page.getByRole('button', { name: /Review preorder/ }).click();
  await page.getByRole('button', { name: 'Review preorder →' }).click();
  await expect(page.getByText('Enter the pickup name.')).toBeVisible();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Enter a valid phone number.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review your preorder' })).not.toBeVisible();
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
