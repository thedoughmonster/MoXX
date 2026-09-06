import {
  checkoutReferenceSchema,
  type CheckoutHandoff,
  type CheckoutNextAction,
  type CheckoutReference,
  type CheckoutStatus
} from './contracts';
import type { CheckoutClient } from './client';

export const checkoutFixtureHandoff: CheckoutHandoff = {
  contract_key: 'momi.cart_checkout.checkout.status.read.v1',
  order_id: '60000000-0000-4000-8000-000000000001',
  order_version: 3,
  shopping_authority_id: '60000000-0000-4000-8000-000000000003'
};

const base = {
  order_id: checkoutFixtureHandoff.order_id,
  order_version: checkoutFixtureHandoff.order_version,
  checkout_version: 2,
  confirmation_ref: null
} as const;

const issue = (code: CheckoutStatus['issues'][number]['code'], message: string,
  retryable: boolean, next_action: CheckoutNextAction) => ({
  code, message, retryable, next_action
});

export const checkoutStatusFixtures = {
  loading: { ...base, customer_state: 'loading', phase: 'review', payment_status: 'not_started', next_actions: ['refresh'], issues: [] },
  empty: { ...base, customer_state: 'empty', phase: 'review', payment_status: 'not_started', next_actions: ['edit_cart'], issues: [] },
  incomplete: { ...base, customer_state: 'incomplete', phase: 'contact', payment_status: 'not_started', next_actions: ['provide_contact'], issues: [] },
  ready: { ...base, customer_state: 'ready', phase: 'payment_required', payment_status: 'required', next_actions: ['initiate_payment'], issues: [] },
  invalid: { ...base, customer_state: 'invalid', phase: 'revalidation', payment_status: 'not_started', next_actions: ['edit_cart'], issues: [issue('invalid', 'Cart details need attention.', false, 'edit_cart')] },
  stale: { ...base, customer_state: 'stale', phase: 'revalidation', payment_status: 'not_started', next_actions: ['refresh'], issues: [issue('stale', 'Refresh before continuing.', true, 'refresh')] },
  pending: { ...base, customer_state: 'pending', phase: 'pending', payment_status: 'pending', next_actions: ['refresh'], issues: [] },
  declined: { ...base, customer_state: 'declined', phase: 'payment_required', payment_status: 'declined', next_actions: ['retry_payment'], issues: [issue('payment_declined', 'Payment was declined.', true, 'retry_payment')] },
  indeterminate: { ...base, customer_state: 'indeterminate', phase: 'recovery', payment_status: 'indeterminate', next_actions: ['recover'], issues: [issue('payment_indeterminate', 'Payment status needs recovery.', false, 'recover')] },
  recovery: { ...base, customer_state: 'recovery_required', phase: 'recovery', payment_status: 'indeterminate', next_actions: ['recover'], issues: [issue('payment_indeterminate', 'Recover payment status before continuing.', false, 'recover')] },
  confirmed: { ...base, customer_state: 'confirmed', phase: 'confirmed', payment_status: 'paid', next_actions: ['view_confirmation'], issues: [], confirmation_ref: { owner_service: 'cart-checkout-operations', contract_key: 'momi.cart_checkout.draft_order.read.v1', resource_id: '60000000-0000-4000-8000-000000000002', resource_version: 1 } }
} satisfies Record<string, CheckoutStatus>;

export type CheckoutFixtureScenario = keyof typeof checkoutStatusFixtures;

const review: CheckoutReference['review'] = {
  lines: [{
    line_id: '60000000-0000-4000-8000-000000000004',
    name: 'Synthetic mixed box',
    detail: 'Fixture item with an intentionally long, wrapping description for layout checks.',
    quantity: 2,
    total: { currency: 'USD', amount_minor: 2400 }
  }],
  fulfillment_summary: 'Fixture pickup window · Test location',
  disclosures: ['Availability and fulfillment are confirmed by the owning flow during revalidation.'],
  totals: [
    { key: 'items', label: 'Items', amount: { currency: 'USD', amount_minor: 2400 } },
    { key: 'tax', label: 'Tax', amount: { currency: 'USD', amount_minor: 210 } },
    { key: 'total', label: 'Total', amount: { currency: 'USD', amount_minor: 2610 } }
  ],
  hold_summary: 'This fixture hold is temporary. Its timing comes from checkout authority.'
};

export function createFixtureCheckoutClient(scenario: CheckoutFixtureScenario): CheckoutClient {
  const response = () => checkoutReferenceSchema.parse({
    status: checkoutStatusFixtures[scenario],
    review
  });
  return {
    async load() { return response(); },
    async act(_handoff, action) {
      const destination: Partial<Record<CheckoutNextAction, CheckoutFixtureScenario>> = {
        provide_contact: 'ready',
        confirm_fulfillment: 'ready',
        retry_payment: 'ready',
        recover: 'confirmed',
        refresh: scenario === 'pending' ? 'confirmed' : 'ready'
      };
      return checkoutReferenceSchema.parse({
        status: checkoutStatusFixtures[destination[action] ?? scenario],
        review
      });
    }
  };
}

export function readFixtureScenario(search: string): CheckoutFixtureScenario {
  const value = new URLSearchParams(search).get('scenario');
  return value && value in checkoutStatusFixtures
    ? value as CheckoutFixtureScenario
    : 'incomplete';
}
