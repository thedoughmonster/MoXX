import { describe, expect, test } from 'vitest';
import { createCheckoutHref, readCheckoutHandoff } from './client';
import {
  checkoutFixtureHandoff,
  checkoutStatusFixtures,
  createFixtureCheckoutClient
} from './fixtures';

describe('canonical checkout adapter', () => {
  test('round trips the explicit cart-to-checkout handoff', () => {
    const href = createCheckoutHref(checkoutFixtureHandoff);
    expect(href.startsWith('/checkout?')).toBe(true);
    expect(readCheckoutHandoff(new URL(href, 'https://example.invalid').search))
      .toEqual(checkoutFixtureHandoff);
  });

  test('rejects incomplete or malformed handoffs', () => {
    expect(readCheckoutHandoff('?order_id=not-an-id&order_version=0')).toBeNull();
  });

  test('covers every canonical customer-safe state fixture', () => {
    expect(new Set(Object.values(checkoutStatusFixtures).map((item) => item.customer_state)))
      .toEqual(new Set([
        'loading', 'empty', 'incomplete', 'ready', 'invalid', 'stale', 'pending',
        'declined', 'indeterminate', 'recovery_required', 'confirmed'
      ]));
  });

  test('moves through contact and fulfillment using canonical contract actions', async () => {
    const client = createFixtureCheckoutClient('incomplete');
    const contact = await client.act(checkoutFixtureHandoff, 'provide_contact');
    expect(contact.status.customer_state).toBe('ready');
    const ready = await client.act(checkoutFixtureHandoff, 'confirm_fulfillment');
    expect(ready.status.customer_state).toBe('ready');
  });
});
