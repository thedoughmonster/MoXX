import { z } from 'zod';

const identifier = z.string().uuid();
const contractKey = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*\.v[1-9][0-9]*$/);
const money = z.strictObject({
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount_minor: z.number().int()
});

export const checkoutContractKeys = {
  command: 'momi.cart_checkout.checkout.command.v1',
  recover: 'momi.cart_checkout.checkout.recover.v1',
  status: 'momi.cart_checkout.checkout.status.read.v1'
} as const;

export const checkoutHandoffSchema = z.strictObject({
  contract_key: z.literal(checkoutContractKeys.status),
  order_id: identifier,
  order_version: z.number().int().positive(),
  shopping_authority_id: identifier
});

export const ownerReadReferenceSchema = z.strictObject({
  owner_service: z.string().regex(/^[a-z][a-z0-9-]+$/),
  contract_key: contractKey,
  resource_id: identifier,
  resource_version: z.number().int().positive()
});

const nextAction = z.enum([
  'refresh', 'edit_cart', 'provide_contact', 'confirm_fulfillment',
  'retry_revalidation', 'initiate_payment', 'retry_payment', 'recover',
  'view_confirmation', 'contact_shop'
]);
const issueCode = z.enum([
  'invalid', 'stale', 'unavailable', 'price_changed', 'fulfillment_changed',
  'capacity_changed', 'cutoff_passed', 'payment_declined',
  'payment_indeterminate'
]);
const customerIssue = z.strictObject({
  code: issueCode,
  message: z.string().max(240),
  retryable: z.boolean(),
  next_action: nextAction
});
const statusIdentity = {
  order_id: identifier,
  order_version: z.number().int().positive(),
  checkout_version: z.number().int().positive()
};
const noIssues = z.tuple([]);
const noConfirmation = z.null();

// Mirrors CheckoutStatusResponse's oneOf branches in the accepted v1 schema.
// Valid enum values in a non-canonical combination are deliberately rejected.
export const checkoutStatusSchema = z.discriminatedUnion('customer_state', [
  z.strictObject({ ...statusIdentity, customer_state: z.literal('loading'), phase: z.literal('review'), payment_status: z.literal('not_started'), next_actions: z.tuple([z.literal('refresh')]), issues: noIssues, confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('empty'), phase: z.literal('review'), payment_status: z.literal('not_started'), next_actions: z.tuple([z.literal('edit_cart')]), issues: noIssues, confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('incomplete'), phase: z.literal('contact'), payment_status: z.literal('not_started'), next_actions: z.tuple([z.literal('provide_contact')]), issues: noIssues, confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('ready'), phase: z.literal('payment_required'), payment_status: z.literal('required'), next_actions: z.tuple([z.literal('initiate_payment')]), issues: noIssues, confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('invalid'), phase: z.literal('revalidation'), payment_status: z.literal('not_started'), next_actions: z.tuple([z.literal('edit_cart')]), issues: z.array(customerIssue.extend({ code: z.enum(['invalid', 'unavailable', 'price_changed', 'fulfillment_changed', 'capacity_changed', 'cutoff_passed']), next_action: z.literal('edit_cart') })).min(1), confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('stale'), phase: z.literal('revalidation'), payment_status: z.literal('not_started'), next_actions: z.tuple([z.literal('refresh')]), issues: z.array(customerIssue.extend({ code: z.enum(['stale', 'price_changed', 'fulfillment_changed', 'capacity_changed', 'cutoff_passed']), next_action: z.literal('refresh') })).min(1), confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('pending'), phase: z.literal('pending'), payment_status: z.literal('pending'), next_actions: z.tuple([z.literal('refresh')]), issues: noIssues, confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('declined'), phase: z.literal('payment_required'), payment_status: z.literal('declined'), next_actions: z.tuple([z.literal('retry_payment')]), issues: z.array(customerIssue.extend({ code: z.literal('payment_declined'), retryable: z.literal(true), next_action: z.literal('retry_payment') })).min(1), confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('indeterminate'), phase: z.literal('recovery'), payment_status: z.literal('indeterminate'), next_actions: z.tuple([z.literal('recover')]), issues: z.array(customerIssue.extend({ code: z.literal('payment_indeterminate'), retryable: z.literal(false), next_action: z.literal('recover') })).min(1), confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('recovery_required'), phase: z.literal('recovery'), payment_status: z.literal('indeterminate'), next_actions: z.tuple([z.literal('recover')]), issues: z.array(customerIssue.extend({ code: z.literal('payment_indeterminate'), retryable: z.literal(false), next_action: z.literal('recover') })).min(1), confirmation_ref: noConfirmation }),
  z.strictObject({ ...statusIdentity, customer_state: z.literal('confirmed'), phase: z.literal('confirmed'), payment_status: z.literal('paid'), next_actions: z.tuple([z.literal('view_confirmation')]), issues: noIssues, confirmation_ref: ownerReadReferenceSchema })
]);

export const customerContactSchema = z.union([
  z.strictObject({ name: z.string().min(1).max(120), email: z.email().max(254), phone: z.string().min(7).max(32).optional() }),
  z.strictObject({ name: z.string().min(1).max(120), email: z.email().max(254).optional(), phone: z.string().min(7).max(32) })
]);
const commandIdentity = {
  command_id: identifier,
  order_id: identifier,
  expected_order_version: z.number().int().positive()
};
export const checkoutCommandRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ ...commandIdentity, action: z.enum(['begin', 'revalidate', 'place', 'resume']) }),
  z.strictObject({ ...commandIdentity, action: z.literal('save_contact'), contact: customerContactSchema }),
  z.strictObject({ ...commandIdentity, action: z.literal('confirm_fulfillment'), fulfillment_ref: ownerReadReferenceSchema })
]);
export const checkoutStatusRequestSchema = z.strictObject({ order_id: identifier });
export const checkoutRecoveryRequestSchema = z.strictObject({
  command_id: identifier,
  order_id: identifier,
  expected_order_version: z.number().int().positive(),
  expected_checkout_version: z.number().int().positive()
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
    fulfillment_ref: ownerReadReferenceSchema,
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
export type CheckoutNextAction = z.infer<typeof nextAction>;
export type CustomerContact = z.infer<typeof customerContactSchema>;
export type OwnerReadReference = z.infer<typeof ownerReadReferenceSchema>;
export type CheckoutCommandRequest = z.infer<typeof checkoutCommandRequestSchema>;
export type CheckoutStatusRequest = z.infer<typeof checkoutStatusRequestSchema>;
export type CheckoutRecoveryRequest = z.infer<typeof checkoutRecoveryRequestSchema>;
