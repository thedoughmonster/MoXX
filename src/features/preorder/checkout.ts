import {
  createPreorderCheckoutHold,
  createPreorderOrderIntent,
  createPreorderQuote,
  initiatePreorderPayment
} from '../../lib/api';
import {
  type Allergen,
  type PreorderPaymentEnvelope
} from '../../lib/contracts';
import { type CustomerDetails } from './draft';
import {
  type CartQuantities,
  type Money,
  type PreorderFixture,
  type Product
} from './model';

export type CheckoutCommands = Readonly<{
  quoteCommandId: string;
  holdCommandId: string;
  orderCommandId: string;
  paymentCommandId: string;
  lineIds: Readonly<Record<string, string>>;
}>;

export type PreparedCheckout = Readonly<{
  orderId: string;
  orderVersion: number;
  recoveryAuthority: string;
  paymentCommandId: string;
  amount: Money;
  quote: Readonly<{
    quoteId: string;
    quoteVersion: number;
    subtotal: Money;
    quantitySavings: Money;
    noticeSavings: Money;
    fees: Money;
    tax: Money;
    total: Money;
    expiresAt: string;
  }>;
}>;

export class CheckoutPreparationError extends Error {
  constructor(readonly code:
    | 'configuration_unavailable'
    | 'empty_cart'
    | 'quote_rejected'
    | 'capacity_unavailable'
    | 'hold_rejected'
    | 'order_rejected'
    | 'binding_mismatch'
  ) {
    super(code);
    this.name = 'CheckoutPreparationError';
  }
}

export type CheckoutDependencies = Readonly<{
  quote: typeof createPreorderQuote;
  hold: typeof createPreorderCheckoutHold;
  order: typeof createPreorderOrderIntent;
  payment: typeof initiatePreorderPayment;
}>;

const defaultDependencies: CheckoutDependencies = {
  quote: createPreorderQuote,
  hold: createPreorderCheckoutHold,
  order: createPreorderOrderIntent,
  payment: initiatePreorderPayment
};

export function createCheckoutCommands(
  products: readonly Product[],
  quantities: CartQuantities,
  createId: () => string = () => crypto.randomUUID()
): CheckoutCommands {
  const lineIds = Object.fromEntries(products
    .filter((product) => (quantities[product.id] ?? 0) > 0)
    .map((product) => [product.id, createId()]));
  return {
    quoteCommandId: createId(),
    holdCommandId: createId(),
    orderCommandId: createId(),
    paymentCommandId: createId(),
    lineIds
  };
}

export async function preparePreorderCheckout(
  input: Readonly<{
    data: PreorderFixture;
    products: readonly Product[];
    quantities: CartQuantities;
    selectedAllergens: readonly Allergen[];
    selectedWindow: string;
    customerDetails: CustomerDetails;
  }>,
  commands: CheckoutCommands,
  dependencies: CheckoutDependencies = defaultDependencies
): Promise<PreparedCheckout> {
  if (
    input.data.source !== 'live'
    || !input.data.surfaceId
    || !input.data.versions
  ) {
    throw new CheckoutPreparationError('configuration_unavailable');
  }

  const lines = input.products
    .map((product) => ({
      line_id: commands.lineIds[product.id] ?? '',
      item_id: product.id,
      item_version: product.itemVersion,
      quantity: input.quantities[product.id] ?? 0,
      choice_ids: [] as const
    }))
    .filter((line) => line.quantity > 0 && line.line_id.length > 0);
  if (lines.length === 0) throw new CheckoutPreparationError('empty_cart');

  const quoteEnvelope = await dependencies.quote({
    command_id: commands.quoteCommandId,
    surface_id: input.data.surfaceId,
    fulfillment_window_id: input.selectedWindow,
    versions: input.data.versions,
    cart_version: 1,
    avoided_allergens: input.selectedAllergens,
    lines
  });
  if (quoteEnvelope.outcome !== 'accepted' || !quoteEnvelope.quote) {
    throw new CheckoutPreparationError('quote_rejected');
  }
  const quote = quoteEnvelope.quote;
  if (quote.capacity_result === 'unavailable') {
    throw new CheckoutPreparationError('capacity_unavailable');
  }

  let holdId: string | undefined;
  if (quote.capacity_result === 'hold_required') {
    const hold = await dependencies.hold({
      command_id: commands.holdCommandId,
      action: 'create',
      quote_id: quote.quote_id,
      expected_quote_version: quote.quote_version
    }, quote.revalidation_token);
    if (hold.outcome !== 'accepted' || hold.hold_status !== 'active') {
      throw new CheckoutPreparationError('hold_rejected');
    }
    holdId = hold.hold_id;
  }

  const order = await dependencies.order({
    command_id: commands.orderCommandId,
    quote_id: quote.quote_id,
    expected_quote_version: quote.quote_version,
    ...(holdId ? { hold_id: holdId } : {}),
    contact: {
      name: input.customerDetails.fullName,
      email: input.customerDetails.email,
      phone: input.customerDetails.phone
    }
  }, quote.revalidation_token);
  if (
    order.outcome !== 'accepted'
    || order.order_status !== 'awaiting_payment'
  ) {
    throw new CheckoutPreparationError('order_rejected');
  }
  if (
    order.amount_due.amount_minor !== quote.total.amount_minor
    || order.amount_due.currency !== quote.total.currency
  ) {
    throw new CheckoutPreparationError('binding_mismatch');
  }

  return {
    orderId: order.order_id,
    orderVersion: order.order_version,
    recoveryAuthority: order.recovery_authority,
    paymentCommandId: commands.paymentCommandId,
    amount: toMoney(order.amount_due),
    quote: {
      quoteId: quote.quote_id,
      quoteVersion: quote.quote_version,
      subtotal: toMoney(quote.line_subtotal),
      quantitySavings: toMoney(quote.quantity_savings),
      noticeSavings: toMoney(quote.notice_savings),
      fees: toMoney(quote.fees),
      tax: toMoney(quote.tax),
      total: toMoney(quote.total),
      expiresAt: quote.expires_at
    }
  };
}

export async function handoffPreorderPayment(
  checkout: PreparedCheckout,
  sourceToken: string,
  dependencies: CheckoutDependencies = defaultDependencies
): Promise<PreorderPaymentEnvelope> {
  const payment = await dependencies.payment({
    command_id: checkout.paymentCommandId,
    order_id: checkout.orderId,
    expected_order_version: checkout.orderVersion,
    source_token: sourceToken
  }, checkout.recoveryAuthority);

  if (
    payment.order_id !== checkout.orderId ||
    payment.amount.amount_minor !== checkout.amount.amountMinor ||
    payment.amount.currency !== checkout.amount.currency
  ) {
    throw new CheckoutPreparationError('binding_mismatch');
  }

  return payment;
}

export function replacePaymentCommand(
  checkout: PreparedCheckout,
  orderVersion: number,
  createId: () => string = crypto.randomUUID
): PreparedCheckout {
  return {
    ...checkout,
    orderVersion,
    paymentCommandId: createId()
  };
}

function toMoney(value: {
  currency: string;
  amount_minor: number;
}): Money {
  return {
    currency: value.currency,
    amountMinor: value.amount_minor
  };
}
