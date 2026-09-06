import { z } from 'zod';

const identifier = z.string().uuid();
const money = z.strictObject({
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount_minor: z.number().int()
});

export const checkoutHandoffSchema = z.strictObject({
  contract_key: z.literal('momi.cart_checkout.checkout.status.read.v1'),
  order_id: identifier,
  order_version: z.number().int().positive(),
  shopping_authority_id: identifier
});

const ownerReadReference = z.strictObject({
  owner_service: z.string().regex(/^[a-z][a-z0-9-]+$/),
  contract_key: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*\.v[1-9][0-9]*$/),
  resource_id: identifier,
  resource_version: z.number().int().positive()
});

const nextAction = z.enum([
  'refresh',
  'edit_cart',
  'provide_contact',
  'confirm_fulfillment',
  'retry_revalidation',
  'initiate_payment',
  'retry_payment',
  'recover',
  'view_confirmation',
  'contact_shop'
]);

export const checkoutStatusSchema = z.strictObject({
  order_id: identifier,
  order_version: z.number().int().positive(),
  checkout_version: z.number().int().positive(),
  customer_state: z.enum([
    'loading', 'empty', 'incomplete', 'ready', 'invalid', 'stale', 'pending',
    'declined', 'indeterminate', 'recovery_required', 'confirmed'
  ]),
  phase: z.enum([
    'review', 'contact', 'fulfillment', 'revalidation', 'payment_required',
    'pending', 'recovery', 'confirmed'
  ]),
  payment_status: z.enum([
    'not_started', 'required', 'pending', 'declined', 'indeterminate', 'paid'
  ]),
  next_actions: z.array(nextAction),
  issues: z.array(z.strictObject({
    code: z.enum([
      'invalid', 'stale', 'unavailable', 'price_changed',
      'fulfillment_changed', 'capacity_changed', 'cutoff_passed',
      'payment_declined', 'payment_indeterminate'
    ]),
    message: z.string().max(240),
    retryable: z.boolean(),
    next_action: nextAction
  })),
  confirmation_ref: ownerReadReference.nullable()
});

export const checkoutReferenceSchema = z.strictObject({
  status: checkoutStatusSchema,
  review: z.strictObject({
    lines: z.array(z.strictObject({
      line_id: identifier,
      name: z.string().min(1).max(120),
      detail: z.string().max(240),
      quantity: z.number().int().positive(),
      total: money
    })),
    fulfillment_summary: z.string().min(1).max(240),
    disclosures: z.array(z.string().max(240)),
    totals: z.array(z.strictObject({
      key: z.string().min(1).max(64),
      label: z.string().min(1).max(120),
      amount: money
    })),
    hold_summary: z.string().min(1).max(240)
  })
});

export type CheckoutHandoff = z.infer<typeof checkoutHandoffSchema>;
export type CheckoutStatus = z.infer<typeof checkoutStatusSchema>;
export type CheckoutReference = z.infer<typeof checkoutReferenceSchema>;
export type CheckoutNextAction = CheckoutStatus['next_actions'][number];
