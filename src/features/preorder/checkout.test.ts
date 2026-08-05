import { describe, expect, test } from 'vitest';
import {
  type PreorderHoldEnvelope,
  type PreorderOrderIntentEnvelope,
  type PreorderPaymentEnvelope,
  type PreorderQuoteEnvelope
} from '../../lib/contracts';
import { preorderFixture } from './fixture';
import {
  CheckoutPreparationError,
  createCheckoutCommands,
  handoffPreorderPayment,
  preparePreorderCheckout,
  type CheckoutDependencies,
  type PreparedCheckout
} from './checkout';
import { type PreorderFixture, type Product } from './model';

const ids = {
  surface: '10000000-0000-4000-8000-000000000001',
  location: '9154e81d-52a1-46ea-a213-e572343a601b',
  window: '10000000-0000-4000-8000-000000000003',
  item: '10000000-0000-4000-8000-000000000004',
  line: '10000000-0000-4000-8000-000000000005',
  quoteCommand: '10000000-0000-4000-8000-000000000006',
  holdCommand: '10000000-0000-4000-8000-000000000007',
  orderCommand: '10000000-0000-4000-8000-000000000008',
  paymentCommand: '10000000-0000-4000-8000-000000000009',
  quote: '10000000-0000-4000-8000-000000000010',
  hold: '10000000-0000-4000-8000-000000000011',
  order: '10000000-0000-4000-8000-000000000012',
  attempt: '10000000-0000-4000-8000-000000000013'
} as const;

const meta = (contract_key: string) => ({
  contract_key,
  request_id: '20000000-0000-4000-8000-000000000001',
  generated_at: '2026-08-05T15:30:00Z'
});

const product: Product = {
  id: ids.item,
  itemVersion: 3,
  name: 'Synthetic Classic',
  description: 'Synthetic checkout fixture.',
  price: { currency: 'USD', amountMinor: 150 },
  art: 'vanilla',
  allergens: [],
  allergenStatus: 'unverified',
  maximumQuantity: 8
};

const liveData: PreorderFixture = {
  source: 'live',
  surfaceId: ids.surface,
  locationId: ids.location,
  versions: {
    surface_version: 3,
    catalog_version: 3,
    policy_version: 3,
    mapping_version: 3
  },
  surfaceName: 'Weekend preorder',
  locationName: 'Dough Monster',
  freshnessLabel: 'Updated just now',
  cancellationPolicy: {
    summary: 'Contact the shop by 5 PM the prior day.',
    customerCancellationAllowed: false,
    customerModificationAllowed: false
  },
  fulfillmentWindows: [{
    id: ids.window,
    eyebrow: 'Soonest',
    day: 'Saturday',
    date: 'Aug 8',
    time: '8:00 AM–2:00 PM',
    availability: 'available'
  }],
  allergenOptions: [],
  products: [product]
};

function quoteEnvelope(
  capacity_result: 'available' | 'hold_required' = 'hold_required'
): PreorderQuoteEnvelope {
  return {
    meta: meta('momi.preorder.quote.create.v1'),
    outcome: 'accepted',
    quote: {
      quote_id: ids.quote,
      quote_version: 1,
      fulfillment_window_id: ids.window,
      line_subtotal: { currency: 'USD', amount_minor: 300 },
      quantity_savings: { currency: 'USD', amount_minor: 0 },
      notice_savings: { currency: 'USD', amount_minor: 0 },
      fees: { currency: 'USD', amount_minor: 0 },
      tax: { currency: 'USD', amount_minor: 0 },
      total: { currency: 'USD', amount_minor: 300 },
      shop_comparison_total: { currency: 'USD', amount_minor: 500 },
      preorder_savings_total: { currency: 'USD', amount_minor: 200 },
      quantity_progress: {
        current_level: 'flat',
        current_threshold: 0,
        current_discount_bps: 0,
        next_level: null,
        next_threshold: null,
        quantity_needed: null
      },
      advance_discount_bps: 0,
      capacity_result,
      versions: liveData.versions!,
      expires_at: '2026-08-05T15:35:00Z',
      revalidation_token: 'checkout-authority-00000000000000000000000000000000'
    }
  };
}

const holdEnvelope: PreorderHoldEnvelope = {
  meta: meta('momi.preorder.checkout_hold.manage.v1'),
  outcome: 'accepted',
  hold_id: ids.hold,
  hold_version: 1,
  hold_status: 'active',
  expires_at: '2026-08-05T15:35:00Z'
};

function orderEnvelope(amountMinor = 300): PreorderOrderIntentEnvelope {
  return {
    meta: meta('momi.preorder.order_intent.create.v1'),
    outcome: 'accepted',
    order_id: ids.order,
    order_version: 1,
    order_status: 'awaiting_payment',
    amount_due: { currency: 'USD', amount_minor: amountMinor },
    recovery_authority: 'recovery-authority-0000000000000000000000000000000'
  };
}

const unreachable: CheckoutDependencies = {
  quote: async () => { throw new Error('unexpected quote'); },
  hold: async () => { throw new Error('unexpected hold'); },
  order: async () => { throw new Error('unexpected order'); },
  payment: async () => { throw new Error('unexpected payment'); }
};

function commands() {
  const values = [
    ids.line,
    ids.quoteCommand,
    ids.holdCommand,
    ids.orderCommand,
    ids.paymentCommand
  ];
  let index = 0;
  return createCheckoutCommands([product], { [product.id]: 2 }, () => values[index++]!);
}

const input = {
  data: liveData,
  products: [product],
  quantities: { [product.id]: 2 },
  selectedAllergens: [],
  selectedWindow: ids.window,
  customerDetails: {
    fullName: 'Synthetic Customer',
    email: 'synthetic@example.invalid',
    phone: '+1 555 010 0200',
    pickupNotes: ''
  }
} as const;

describe('authoritative preorder checkout preparation', () => {
  test('binds v3 configuration, item version, capacity hold, order, and money', async () => {
    let quoted: Parameters<CheckoutDependencies['quote']>[0] | undefined;
    let held: Parameters<CheckoutDependencies['hold']> | undefined;
    let ordered: Parameters<CheckoutDependencies['order']> | undefined;
    const dependencies: CheckoutDependencies = {
      ...unreachable,
      quote: async (request) => {
        quoted = request;
        return quoteEnvelope();
      },
      hold: async (...args) => {
        held = args;
        return holdEnvelope;
      },
      order: async (...args) => {
        ordered = args;
        return orderEnvelope();
      }
    };

    const result = await preparePreorderCheckout(input, commands(), dependencies);

    expect(quoted).toMatchObject({
      command_id: ids.quoteCommand,
      surface_id: ids.surface,
      fulfillment_window_id: ids.window,
      versions: liveData.versions,
      avoided_allergens: [],
      lines: [{
        line_id: ids.line,
        item_id: ids.item,
        item_version: 3,
        quantity: 2,
        choice_ids: []
      }]
    });
    expect(held).toEqual([{
      command_id: ids.holdCommand,
      action: 'create',
      quote_id: ids.quote,
      expected_quote_version: 1
    }, quoteEnvelope().quote!.revalidation_token]);
    expect(ordered).toEqual([{
      command_id: ids.orderCommand,
      quote_id: ids.quote,
      expected_quote_version: 1,
      hold_id: ids.hold,
      contact: {
        name: 'Synthetic Customer',
        email: 'synthetic@example.invalid',
        phone: '+1 555 010 0200'
      }
    }, quoteEnvelope().quote!.revalidation_token]);
    expect(result).toMatchObject({
      orderId: ids.order,
      orderVersion: 1,
      paymentCommandId: ids.paymentCommand,
      amount: { currency: 'USD', amountMinor: 300 },
      quote: { total: { currency: 'USD', amountMinor: 300 } }
    });
  });

  test('does not create a hold when capacity is immediately available', async () => {
    let holdCalled = false;
    const dependencies: CheckoutDependencies = {
      ...unreachable,
      quote: async () => quoteEnvelope('available'),
      hold: async () => {
        holdCalled = true;
        return holdEnvelope;
      },
      order: async () => orderEnvelope()
    };

    await preparePreorderCheckout(input, commands(), dependencies);
    expect(holdCalled).toBe(false);
  });

  test('fails before network work for fixture data', async () => {
    await expect(preparePreorderCheckout({
      ...input,
      data: preorderFixture,
      products: [preorderFixture.products[0]!],
      quantities: { [preorderFixture.products[0]!.id]: 1 }
    }, createCheckoutCommands(
      [preorderFixture.products[0]!],
      { [preorderFixture.products[0]!.id]: 1 }
    ), unreachable)).rejects.toEqual(
      new CheckoutPreparationError('configuration_unavailable')
    );
  });

  test('fails closed when the durable order amount differs from the quote', async () => {
    const dependencies: CheckoutDependencies = {
      ...unreachable,
      quote: async () => quoteEnvelope('available'),
      order: async () => orderEnvelope(301)
    };

    await expect(preparePreorderCheckout(input, commands(), dependencies))
      .rejects.toEqual(new CheckoutPreparationError('binding_mismatch'));
  });
});

describe('one-use payment initiation handoff', () => {
  test('sends the source token once with exact order/version/recovery binding', async () => {
    const prepared: PreparedCheckout = {
      orderId: ids.order,
      orderVersion: 1,
      recoveryAuthority: orderEnvelope().recovery_authority,
      paymentCommandId: ids.paymentCommand,
      amount: { currency: 'USD', amountMinor: 300 },
      quote: {
        quoteId: ids.quote,
        quoteVersion: 1,
        subtotal: { currency: 'USD', amountMinor: 300 },
        quantitySavings: { currency: 'USD', amountMinor: 0 },
        noticeSavings: { currency: 'USD', amountMinor: 0 },
        fees: { currency: 'USD', amountMinor: 0 },
        tax: { currency: 'USD', amountMinor: 0 },
        total: { currency: 'USD', amountMinor: 300 },
        expiresAt: '2026-08-05T15:35:00Z'
      }
    };
    const payment: PreorderPaymentEnvelope = {
      meta: meta('momi.preorder.payment.initiate.v1'),
      outcome: 'accepted',
      order_id: ids.order,
      order_version: 3,
      payment_attempt_id: ids.attempt,
      payment_status: 'paid',
      amount: { currency: 'USD', amount_minor: 300 },
      next_actions: ['view_status', 'contact_shop']
    };
    let invocation: Parameters<CheckoutDependencies['payment']> | undefined;
    const result = await handoffPreorderPayment(
      prepared,
      'cnon:single-use-synthetic-token',
      {
        ...unreachable,
        payment: async (...args) => {
          invocation = args;
          return payment;
        }
      }
    );

    expect(invocation).toEqual([{
      command_id: ids.paymentCommand,
      order_id: ids.order,
      expected_order_version: 1,
      source_token: 'cnon:single-use-synthetic-token'
    }, orderEnvelope().recovery_authority]);
    expect(result).toEqual(payment);
  });
});
