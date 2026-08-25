import { z } from 'zod';

const identifier = z.string().uuid();
const stableKey = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/);
const allergen = z.enum([
  'milk',
  'egg',
  'peanuts',
  'tree_nuts',
  'wheat',
  'soy',
  'sesame'
]);

const money = z.strictObject({
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount_minor: z.number().int().nonnegative()
});

const versionSet = z.strictObject({
  surface_version: z.number().int().positive(),
  catalog_version: z.number().int().positive(),
  policy_version: z.number().int().positive(),
  mapping_version: z.number().int().positive()
});

const responseMeta = (contractKey: string) => z.strictObject({
  contract_key: z.literal(contractKey),
  request_id: identifier,
  generated_at: z.iso.datetime({ offset: true })
});

const fulfillmentWindow = z.strictObject({
  window_id: identifier,
  date: z.iso.date(),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  order_cutoff_at: z.iso.datetime({ offset: true }),
  availability: z.enum(['available', 'limited', 'closed', 'sold_out'])
});

const catalogItem = z.strictObject({
  item_id: identifier,
  item_version: z.number().int().positive(),
  category: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  description: z.string().max(1000),
  base_price: money,
  shop_price: money.nullable(),
  price_floor: money.nullable(),
  media: z.array(z.strictObject({ url: z.url(), alt: z.string().max(240) })),
  allergen_status: z.enum([
    'verified',
    'contains_declared',
    'cross_contact_possible',
    'unverified'
  ]),
  allergens: z.array(allergen),
  seasonal_eligibility: z.enum(['eligible', 'ineligible']),
  available: z.boolean(),
  maximum_quantity: z.number().int().nonnegative(),
  option_groups: z.array(z.unknown()),
  disclosures: z.array(z.string().max(240))
});

export const preorderBootstrapEnvelope = z.strictObject({
  meta: responseMeta('momi.preorder.bootstrap.read.v1'),
  data: z.strictObject({
    surface_id: identifier,
    surface_key: stableKey,
    location_id: identifier,
    location_name: z.string().min(1).max(120),
    timezone: z.string().min(1).max(64),
    versions: versionSet,
    fulfillment_windows: z.array(fulfillmentWindow),
    catalog: z.array(catalogItem),
    cancellation_policy: z.strictObject({
      summary: z.string().max(500),
      customer_cancellation_allowed: z.boolean(),
      customer_modification_allowed: z.boolean()
    }),
    fresh_at: z.iso.datetime({ offset: true }),
    expires_at: z.iso.datetime({ offset: true })
  })
});

const quantityProgress = z.strictObject({
  current_level: z.string().min(1),
  current_threshold: z.number().int().nonnegative(),
  current_discount_bps: z.number().int().min(0).max(10_000),
  next_level: z.string().nullable(),
  next_threshold: z.number().int().positive().nullable(),
  quantity_needed: z.number().int().positive().nullable()
});

const quote = z.strictObject({
  quote_id: identifier,
  quote_version: z.number().int().positive(),
  fulfillment_window_id: identifier,
  line_subtotal: money,
  quantity_savings: money,
  notice_savings: money,
  fees: money,
  tax: money,
  total: money,
  shop_comparison_total: money,
  preorder_savings_total: money,
  quantity_progress: quantityProgress,
  advance_discount_bps: z.number().int().min(0).max(10_000),
  capacity_result: z.enum(['available', 'hold_required', 'unavailable']),
  versions: versionSet,
  expires_at: z.iso.datetime({ offset: true }),
  revalidation_token: z.string().min(32).max(512)
});

export const preorderQuoteEnvelope = z.strictObject({
  meta: responseMeta('momi.preorder.quote.create.v1'),
  outcome: z.enum(['accepted', 'rejected', 'conflict']),
  quote: quote.nullable()
});

const commandOutcome = z.enum([
  'accepted',
  'rejected',
  'pending',
  'conflict',
  'indeterminate'
]);

export const preorderHoldEnvelope = z.strictObject({
  meta: responseMeta('momi.preorder.checkout_hold.manage.v1'),
  outcome: commandOutcome,
  hold_id: identifier,
  hold_version: z.number().int().positive(),
  hold_status: z.enum(['active', 'released', 'expired']),
  expires_at: z.iso.datetime({ offset: true })
});

export const preorderOrderIntentEnvelope = z.strictObject({
  meta: responseMeta('momi.preorder.order_intent.create.v1'),
  outcome: commandOutcome,
  order_id: identifier,
  order_version: z.number().int().positive(),
  order_status: z.enum([
    'awaiting_payment',
    'payment_pending',
    'confirmed',
    'canceled',
    'expired'
  ]),
  amount_due: money,
  recovery_authority: z.string().min(32).max(512)
});

const allowedAction = z.enum([
  'initiate_payment',
  'retry_payment',
  'reconcile_payment',
  'view_status',
  'request_cancellation',
  'request_modification',
  'contact_shop'
]);

export const preorderPaymentEnvelope = z.strictObject({
  meta: responseMeta('momi.preorder.payment.initiate.v1'),
  outcome: commandOutcome,
  order_id: identifier,
  order_version: z.number().int().positive(),
  payment_attempt_id: identifier,
  payment_status: z.enum([
    'not_started',
    'pending',
    'authorized',
    'paid',
    'declined',
    'canceled',
    'refund_pending',
    'refunded',
    'indeterminate'
  ]),
  amount: money,
  next_actions: z.array(allowedAction)
});

export type Allergen = z.infer<typeof allergen>;
export type MoneyContract = z.infer<typeof money>;
export type VersionSet = z.infer<typeof versionSet>;
export type PreorderBootstrapEnvelope = z.infer<typeof preorderBootstrapEnvelope>;
export type PreorderQuoteEnvelope = z.infer<typeof preorderQuoteEnvelope>;
export type PreorderHoldEnvelope = z.infer<typeof preorderHoldEnvelope>;
export type PreorderOrderIntentEnvelope = z.infer<typeof preorderOrderIntentEnvelope>;
export type PreorderPaymentEnvelope = z.infer<typeof preorderPaymentEnvelope>;

export type QuoteRequest = Readonly<{
  command_id: string;
  surface_id: string;
  fulfillment_window_id: string;
  versions: VersionSet;
  cart_version: number;
  avoided_allergens: readonly Allergen[];
  lines: readonly Readonly<{
    line_id: string;
    item_id: string;
    item_version: number;
    quantity: number;
    choice_ids: readonly string[];
  }>[];
}>;

export type HoldRequest = Readonly<{
  command_id: string;
  action: 'create';
  quote_id: string;
  expected_quote_version: number;
}>;

export type OrderIntentRequest = Readonly<{
  command_id: string;
  quote_id: string;
  expected_quote_version: number;
  hold_id?: string;
  contact: Readonly<{
    name: string;
    email: string;
    phone: string;
  }>;
}>;

export type PaymentInitiateRequest = Readonly<{
  command_id: string;
  order_id: string;
  expected_order_version: number;
  source_token: string;
}>;
