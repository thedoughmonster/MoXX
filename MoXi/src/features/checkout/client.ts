import {
  checkoutHandoffSchema,
  type CheckoutHandoff,
  type CheckoutNextAction,
  type CheckoutReference
} from './contracts';

export type CheckoutClient = Readonly<{
  load(handoff: CheckoutHandoff): Promise<CheckoutReference>;
  act(handoff: CheckoutHandoff, action: CheckoutNextAction): Promise<CheckoutReference>;
}>;

export const CHECKOUT_PATH = '/checkout';

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
