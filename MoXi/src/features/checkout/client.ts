import {
  checkoutCommandRequestSchema,
  checkoutHandoffSchema,
  checkoutRecoveryRequestSchema,
  checkoutStatusRequestSchema,
  type CheckoutCommandRequest,
  type CheckoutHandoff,
  type CheckoutRecoveryRequest,
  type CheckoutReference,
  type CheckoutStatusRequest,
  type CustomerContact,
  type OwnerReadReference
} from './contracts';

export type CheckoutClient = Readonly<{
  load(request: CheckoutStatusRequest): Promise<CheckoutReference>;
  command(request: CheckoutCommandRequest): Promise<CheckoutReference>;
  recover(request: CheckoutRecoveryRequest): Promise<CheckoutReference>;
}>;

export const CHECKOUT_PATH = '/checkout';
export const CHECKOUT_REFERENCE_PATH = '/checkout/reference';

export function createCheckoutHref(handoff: CheckoutHandoff): string {
  const accepted = checkoutHandoffSchema.parse(handoff);
  const search = new URLSearchParams({
    order_id: accepted.order_id,
    order_version: String(accepted.order_version),
    shopping_authority_id: accepted.shopping_authority_id
  });
  return `${CHECKOUT_PATH}?${search.toString()}`;
}

export function readCheckoutHandoff(search: string): CheckoutHandoff | null {
  const params = new URLSearchParams(search);
  const parsed = checkoutHandoffSchema.safeParse({
    contract_key: 'momi.cart_checkout.checkout.status.read.v1',
    order_id: params.get('order_id'),
    order_version: Number(params.get('order_version')),
    shopping_authority_id: params.get('shopping_authority_id')
  });
  return parsed.success ? parsed.data : null;
}

export function createStatusRequest(handoff: CheckoutHandoff): CheckoutStatusRequest {
  return checkoutStatusRequestSchema.parse({ order_id: handoff.order_id });
}

type CommandInput =
  | Readonly<{ action: 'save_contact'; contact: CustomerContact }>
  | Readonly<{ action: 'confirm_fulfillment'; fulfillment_ref: OwnerReadReference }>
  | Readonly<{ action: 'begin' | 'revalidate' | 'place' | 'resume' }>;

export function createCommandRequest(
  handoff: CheckoutHandoff,
  expectedOrderVersion: number,
  commandId: string,
  input: CommandInput
): CheckoutCommandRequest {
  return checkoutCommandRequestSchema.parse({
    command_id: commandId,
    order_id: handoff.order_id,
    expected_order_version: expectedOrderVersion,
    ...input
  });
}

export function createRecoveryRequest(
  handoff: CheckoutHandoff,
  expectedOrderVersion: number,
  expectedCheckoutVersion: number,
  commandId: string
): CheckoutRecoveryRequest {
  return checkoutRecoveryRequestSchema.parse({
    command_id: commandId,
    order_id: handoff.order_id,
    expected_order_version: expectedOrderVersion,
    expected_checkout_version: expectedCheckoutVersion
  });
}
