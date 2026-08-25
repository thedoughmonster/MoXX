import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildPreorderBootstrapUrl,
  createPreorderCheckoutHold,
  createPreorderOrderIntent,
  createPreorderQuote,
  initiatePreorderPayment
} from './api';
import * as config from './config';
import {
  type PreorderHoldEnvelope,
  type PreorderOrderIntentEnvelope,
  type PreorderPaymentEnvelope,
  type PreorderQuoteEnvelope
} from './contracts';

const meta = (contract_key: string) => ({
  contract_key,
  request_id: '30000000-0000-4000-8000-000000000001',
  generated_at: '2026-08-05T16:00:00Z'
});

const ids = {
  command: '30000000-0000-4000-8000-000000000002',
  surface: '30000000-0000-4000-8000-000000000003',
  window: '30000000-0000-4000-8000-000000000004',
  line: '30000000-0000-4000-8000-000000000005',
  item: '30000000-0000-4000-8000-000000000006',
  quote: '30000000-0000-4000-8000-000000000007',
  hold: '30000000-0000-4000-8000-000000000008',
  order: '30000000-0000-4000-8000-000000000009',
  attempt: '30000000-0000-4000-8000-000000000010'
} as const;

const quote: PreorderQuoteEnvelope = {
  meta: meta('momi.preorder.quote.create.v1'),
  outcome: 'accepted',
  quote: {
    quote_id: ids.quote,
    quote_version: 1,
    fulfillment_window_id: ids.window,
    line_subtotal: { currency: 'USD', amount_minor: 150 },
    quantity_savings: { currency: 'USD', amount_minor: 0 },
    notice_savings: { currency: 'USD', amount_minor: 0 },
    fees: { currency: 'USD', amount_minor: 0 },
    tax: { currency: 'USD', amount_minor: 0 },
    total: { currency: 'USD', amount_minor: 150 },
    shop_comparison_total: { currency: 'USD', amount_minor: 250 },
    preorder_savings_total: { currency: 'USD', amount_minor: 100 },
    quantity_progress: {
      current_level: 'flat',
      current_threshold: 0,
      current_discount_bps: 0,
      next_level: null,
      next_threshold: null,
      quantity_needed: null
    },
    advance_discount_bps: 0,
    capacity_result: 'hold_required',
    versions: {
      surface_version: 3,
      catalog_version: 3,
      policy_version: 3,
      mapping_version: 3
    },
    expires_at: '2026-08-05T16:05:00Z',
    revalidation_token: 'checkout-authority-00000000000000000000000000000000'
  }
};

const hold: PreorderHoldEnvelope = {
  meta: meta('momi.preorder.checkout_hold.manage.v1'),
  outcome: 'accepted',
  hold_id: ids.hold,
  hold_version: 1,
  hold_status: 'active',
  expires_at: '2026-08-05T16:05:00Z'
};

const order: PreorderOrderIntentEnvelope = {
  meta: meta('momi.preorder.order_intent.create.v1'),
  outcome: 'accepted',
  order_id: ids.order,
  order_version: 1,
  order_status: 'awaiting_payment',
  amount_due: { currency: 'USD', amount_minor: 150 },
  recovery_authority: 'recovery-authority-0000000000000000000000000000000'
};

const payment: PreorderPaymentEnvelope = {
  meta: meta('momi.preorder.payment.initiate.v1'),
  outcome: 'pending',
  order_id: ids.order,
  order_version: 2,
  payment_attempt_id: ids.attempt,
  payment_status: 'pending',
  amount: { currency: 'USD', amount_minor: 150 },
  next_actions: ['reconcile_payment', 'view_status', 'contact_shop']
};

afterEach(() => vi.unstubAllGlobals());

describe('preorder function client boundary', () => {
  test('builds the accepted bootstrap URL with exact origin', () => {
    const originalOrigin = config.apiOrigin;
    expect(buildPreorderBootstrapUrl()).toBe(
      `${originalOrigin}/functions/v1/momi-preorder-bootstrap-v1?surface_key=preorder`
    );
  });

  test('does not expose table-specific paths', () => {
    const path = buildPreorderBootstrapUrl();
    expect(path.includes('/rest/v1/')).toBe(false);
  });

  test('posts the exact version-bound quote contract without credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(Response.json(quote));
    vi.stubGlobal('fetch', fetchMock);

    await createPreorderQuote({
      command_id: ids.command,
      surface_id: ids.surface,
      fulfillment_window_id: ids.window,
      versions: quote.quote!.versions,
      cart_version: 1,
      avoided_allergens: [],
      lines: [{
        line_id: ids.line,
        item_id: ids.item,
        item_version: 3,
        quantity: 1,
        choice_ids: []
      }]
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/functions/v1/momi-preorder-quote-v1');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      versions: quote.quote!.versions,
      avoided_allergens: [],
      lines: [{ item_version: 3 }]
    });
  });

  test('uses checkout authority only in protected hold and order headers', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(Response.json(hold))
      .mockResolvedValueOnce(Response.json(order));
    vi.stubGlobal('fetch', fetchMock);
    const authority = quote.quote!.revalidation_token;

    await createPreorderCheckoutHold({
      command_id: ids.command,
      action: 'create',
      quote_id: ids.quote,
      expected_quote_version: 1
    }, authority);
    await createPreorderOrderIntent({
      command_id: ids.command,
      quote_id: ids.quote,
      expected_quote_version: 1,
      hold_id: ids.hold,
      contact: {
        name: 'Synthetic Customer',
        email: 'synthetic@example.invalid',
        phone: '+1 555 010 0300'
      }
    }, authority);

    for (const [url, init] of fetchMock.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-MoMi-Checkout-Authority')).toBe(authority);
      expect(String(url)).not.toContain(authority);
      expect(String(init?.body)).not.toContain(authority);
    }
  });

  test('keeps the one-use source token in the initiation body only', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(Response.json(payment));
    vi.stubGlobal('fetch', fetchMock);
    const sourceToken = 'cnon:synthetic-single-use-token';

    await initiatePreorderPayment({
      command_id: ids.command,
      order_id: ids.order,
      expected_order_version: 1,
      source_token: sourceToken
    }, order.recovery_authority);

    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(String(url)).toContain('/functions/v1/momi-preorder-payment-initiate-v1');
    expect(String(url)).not.toContain(sourceToken);
    expect(JSON.stringify(Object.fromEntries(headers.entries()))).not.toContain(sourceToken);
    expect(headers.get('X-MoMi-Recovery-Authority')).toBe(order.recovery_authority);
    expect(JSON.parse(String(init?.body))).toEqual({
      command_id: ids.command,
      order_id: ids.order,
      expected_order_version: 1,
      source_token: sourceToken
    });
  });
});
