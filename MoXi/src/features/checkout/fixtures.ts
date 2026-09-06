import canonicalCustomerStates from '../../../../MoMi/services/cart-checkout-operations/fixtures/customer-states.json';
import { z } from 'zod';
import {
  checkoutCommandRequestSchema,
  checkoutRecoveryRequestSchema,
  checkoutReferenceSchema,
  checkoutStatusRequestSchema,
  checkoutStatusSchema,
  type CheckoutHandoff,
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

const acceptedStatuses = z.array(checkoutStatusSchema).parse(canonicalCustomerStates);
const statusByCustomerState = (state: CheckoutStatus['customer_state']) => {
  const status = acceptedStatuses.find((candidate) => candidate.customer_state === state);
  if (!status) throw new Error(`Accepted fixture is missing checkout state: ${state}`);
  return status;
};

// These are the accepted MOX-439 fixtures, parsed directly from the owning
// service. Scenario aliases are presentation-only and add no checkout policy.
export const checkoutStatusFixtures = {
  loading: statusByCustomerState('loading'),
  empty: statusByCustomerState('empty'),
  incomplete: statusByCustomerState('incomplete'),
  ready: statusByCustomerState('ready'),
  invalid: statusByCustomerState('invalid'),
  stale: statusByCustomerState('stale'),
  pending: statusByCustomerState('pending'),
  declined: statusByCustomerState('declined'),
  indeterminate: statusByCustomerState('indeterminate'),
  recovery: statusByCustomerState('recovery_required'),
  confirmed: statusByCustomerState('confirmed')
} as const;

export type CheckoutFixtureScenario = keyof typeof checkoutStatusFixtures;
export type CheckoutFixtureFailure = 'load-once' | 'command-once' | 'fulfillment-once' | 'recover-once';

const fulfillmentRef = {
  owner_service: 'fixture-fulfillment-owner',
  contract_key: 'fixture.fulfillment.read.v1',
  resource_id: '60000000-0000-4000-8000-000000000005',
  resource_version: 1
} as const;
const review: CheckoutReference['review'] = {
  lines: [{
    line_id: '60000000-0000-4000-8000-000000000004',
    name: 'Synthetic mixed box',
    detail: 'Fixture item with an intentionally long, wrapping description for layout checks.',
    quantity: 2,
    total: { currency: 'USD', amount_minor: 2400 }
  }],
  fulfillment_ref: fulfillmentRef,
  fulfillment_summary: 'Fixture pickup window · Test location',
  disclosures: ['Availability and fulfillment are confirmed by the owning flow during revalidation.'],
  totals: [
    { key: 'items', label: 'Items', amount: { currency: 'USD', amount_minor: 2400 } },
    { key: 'tax', label: 'Tax', amount: { currency: 'USD', amount_minor: 210 } },
    { key: 'total', label: 'Total', amount: { currency: 'USD', amount_minor: 2610 } }
  ],
  hold_summary: 'This fixture hold is temporary. Its timing comes from checkout authority.'
};

export function createFixtureCheckoutClient(
  scenario: CheckoutFixtureScenario,
  failure?: CheckoutFixtureFailure
): CheckoutClient {
  let remainingFailures = failure === 'load-once' ? 2 : failure ? 1 : 0;
  let current = checkoutReferenceSchema.parse({
    status: checkoutStatusFixtures[scenario],
    review
  });
  let paymentSubmitted = false;
  const transition = (nextScenario: CheckoutFixtureScenario) => {
    current = checkoutReferenceSchema.parse({
      status: {
        ...checkoutStatusFixtures[nextScenario],
        order_version: current.status.order_version + 1,
        checkout_version: current.status.checkout_version + 1
      },
      review: current.review
    });
    return structuredClone(current);
  };
  const assertVersion = (expected: number) => {
    if (expected !== current.status.order_version) throw new Error('Synthetic version conflict');
  };
  const rejectOnce = (target: CheckoutFixtureFailure) => {
    if (failure !== target || remainingFailures === 0) return;
    remainingFailures -= 1;
    throw new Error('Synthetic adapter rejection');
  };

  return {
    async load(request) {
      checkoutStatusRequestSchema.parse(request);
      rejectOnce('load-once');
      // A submitted fixture payment settles on refresh. The standalone pending
      // scenario intentionally remains pending for repeated status inspection.
      if (paymentSubmitted && current.status.customer_state === 'pending') {
        return transition('confirmed');
      }
      return structuredClone(current);
    },
    async command(request) {
      const accepted = checkoutCommandRequestSchema.parse(request);
      assertVersion(accepted.expected_order_version);
      rejectOnce('command-once');
      if (accepted.action === 'confirm_fulfillment') {
        if (JSON.stringify(accepted.fulfillment_ref) !== JSON.stringify(current.review.fulfillment_ref)) {
          throw new Error('Synthetic fulfillment reference conflict');
        }
        rejectOnce('fulfillment-once');
      }
      if (accepted.action === 'save_contact') {
        // Exercise callers consuming the latest owner reference after a save.
        current.review.fulfillment_ref.resource_version += 1;
      }
      const destination = accepted.action === 'save_contact'
        ? 'incomplete'
        : accepted.action === 'confirm_fulfillment'
          ? 'ready'
          : accepted.action === 'revalidate' || accepted.action === 'resume'
            ? 'ready'
            : accepted.action === 'place'
              ? 'pending'
              : current.status.customer_state === 'recovery_required' ? 'recovery' : current.status.customer_state;
      if (accepted.action === 'place') paymentSubmitted = true;
      return transition(destination);
    },
    async recover(request) {
      const accepted = checkoutRecoveryRequestSchema.parse(request);
      assertVersion(accepted.expected_order_version);
      if (accepted.expected_checkout_version !== current.status.checkout_version) {
        throw new Error('Synthetic checkout version conflict');
      }
      rejectOnce('recover-once');
      return transition('confirmed');
    }
  };
}

export function readFixtureScenario(search: string): CheckoutFixtureScenario {
  const value = new URLSearchParams(search).get('scenario');
  return value && value in checkoutStatusFixtures
    ? value as CheckoutFixtureScenario
    : 'incomplete';
}

export function readFixtureFailure(search: string): CheckoutFixtureFailure | undefined {
  const value = new URLSearchParams(search).get('failure');
  return value === 'load-once' || value === 'command-once' || value === 'fulfillment-once' || value === 'recover-once'
    ? value
    : undefined;
}
