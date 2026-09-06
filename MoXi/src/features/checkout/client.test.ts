import { describe, expect, test } from 'vitest';
import {
  createCheckoutHref,
  createCommandRequest,
  createRecoveryRequest,
  createStatusRequest,
  readCheckoutHandoff
} from './client';
import { checkoutStatusSchema } from './contracts';
import {
  checkoutFixtureHandoff,
  checkoutStatusFixtures,
  createFixtureCheckoutClient
} from './fixtures';

const commandId = '60000000-0000-4000-8000-000000000006';

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

  test('consumes every accepted canonical customer-state fixture', () => {
    expect(new Set(Object.values(checkoutStatusFixtures).map((item) => item.customer_state)))
      .toEqual(new Set([
        'loading', 'empty', 'incomplete', 'ready', 'invalid', 'stale', 'pending',
        'declined', 'indeterminate', 'recovery_required', 'confirmed'
      ]));
  });

  test('rejects a cross-field-invalid status even when each enum value is valid', () => {
    expect(checkoutStatusSchema.safeParse({
      ...checkoutStatusFixtures.ready,
      phase: 'confirmed'
    }).success).toBe(false);
  });

  test('forms accepted versioned status, command, and recovery requests', () => {
    expect(createStatusRequest(checkoutFixtureHandoff)).toEqual({
      order_id: checkoutFixtureHandoff.order_id
    });
    expect(createCommandRequest(checkoutFixtureHandoff, 3, commandId, {
      action: 'save_contact',
      contact: { name: 'Synthetic Customer', email: 'customer@example.invalid' }
    })).toEqual({
      command_id: commandId,
      order_id: checkoutFixtureHandoff.order_id,
      expected_order_version: 3,
      action: 'save_contact',
      contact: { name: 'Synthetic Customer', email: 'customer@example.invalid' }
    });
    expect(createRecoveryRequest(checkoutFixtureHandoff, 3, 2, commandId)).toEqual({
      command_id: commandId,
      order_id: checkoutFixtureHandoff.order_id,
      expected_order_version: 3,
      expected_checkout_version: 2
    });
  });

  test('moves through contact and fulfillment with canonical commands', async () => {
    const client = createFixtureCheckoutClient('incomplete');
    const contact = await client.command(createCommandRequest(
      checkoutFixtureHandoff,
      3,
      commandId,
      {
        action: 'save_contact',
        contact: { name: 'Synthetic Customer', email: 'customer@example.invalid' }
      }
    ));
    expect(contact.status.customer_state).toBe('incomplete');
    const ready = await client.command(createCommandRequest(
      checkoutFixtureHandoff,
      contact.status.order_version,
      commandId,
      { action: 'confirm_fulfillment', fulfillment_ref: contact.review.fulfillment_ref }
    ));
    expect(ready.status.customer_state).toBe('ready');
  });
});
