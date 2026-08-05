import { useMemo, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { PreorderApiError } from '../../lib/api';
import {
  type Allergen,
  type PreorderPaymentEnvelope
} from '../../lib/contracts';
import {
  SquarePaymentPanel,
  type SquarePaymentActivation
} from '../../integrations/square-web-payments';
import {
  CheckoutPreparationError,
  createCheckoutCommands,
  handoffPreorderPayment,
  preparePreorderCheckout,
  replacePaymentCommand,
  type CheckoutCommands,
  type PreparedCheckout
} from './checkout';
import { clearRecoverableDraft, type CustomerDetails } from './draft';
import {
  type CartQuantities,
  type PreorderFixture,
  type Product,
  formatMoney
} from './model';

type ReviewPreorderProps = {
  customerDetails: CustomerDetails;
  data: PreorderFixture;
  pickupLabel: string;
  products: Product[];
  quantities: CartQuantities;
  selectedAllergens: Allergen[];
  selectedWindow: string;
  onEditDetails: () => void;
  onKeepShopping: () => void;
};

type PreparationPhase = 'idle' | 'preparing' | 'failed' | 'ready';

export function ReviewPreorder({
  customerDetails,
  data,
  pickupLabel,
  products,
  quantities,
  selectedAllergens,
  selectedWindow,
  onEditDetails,
  onKeepShopping
}: ReviewPreorderProps) {
  const lines = products
    .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
    .filter((line) => line.quantity > 0);
  const subtotalMinor = lines.reduce(
    (sum, line) => sum + line.product.price.amountMinor * line.quantity,
    0
  );
  const commands = useRef<CheckoutCommands | null>(null);
  const [preparationPhase, setPreparationPhase] =
    useState<PreparationPhase>('idle');
  const [preparationMessage, setPreparationMessage] = useState('');
  const [prepared, setPrepared] = useState<PreparedCheckout | null>(null);
  const [payment, setPayment] = useState<PreorderPaymentEnvelope | null>(null);
  const [paymentIndeterminate, setPaymentIndeterminate] = useState(false);

  const prepare = async () => {
    if (preparationPhase === 'preparing' || prepared) return;
    commands.current ??= createCheckoutCommands(products, quantities);
    setPreparationPhase('preparing');
    setPreparationMessage('');
    try {
      const checkout = await preparePreorderCheckout({
        data,
        products,
        quantities,
        selectedAllergens,
        selectedWindow,
        customerDetails
      }, commands.current);
      setPrepared(checkout);
      setPreparationPhase('ready');
    } catch (error) {
      setPreparationMessage(customerSafePreparationMessage(error));
      setPreparationPhase('failed');
    }
  };

  const paymentActivation = useMemo<SquarePaymentActivation>(() => {
    if (!prepared) {
      return {
        status: 'inactive',
        reason: data.source === 'live'
          ? 'order_unavailable'
          : 'configuration_unavailable'
      };
    }
    return {
      status: 'ready',
      initiationKey: `${prepared.orderId}:${prepared.paymentCommandId}`,
      verificationDetails: {
        amount: (prepared.amount.amountMinor / 100).toFixed(2),
        currencyCode: prepared.amount.currency,
        customerInitiated: true,
        intent: 'CHARGE',
        sellerKeyedIn: false
      },
      handoff: async (sourceToken) => {
        try {
          const receipt = await handoffPreorderPayment(prepared, sourceToken);
          setPayment(receipt);
          if (receipt.payment_status === 'paid') clearRecoverableDraft();
          if (
            receipt.outcome === 'indeterminate'
            || receipt.payment_status === 'indeterminate'
          ) {
            setPaymentIndeterminate(true);
            throw new Error('payment_indeterminate');
          }
        } catch {
          setPaymentIndeterminate(true);
          throw new Error('payment_indeterminate');
        }
      }
    };
  }, [data.source, prepared]);

  const retryDeclinedPayment = () => {
    if (!prepared || !payment?.next_actions.includes('retry_payment')) return;
    setPrepared(replacePaymentCommand(prepared, payment.order_version));
    setPayment(null);
    setPaymentIndeterminate(false);
  };

  const quote = prepared?.quote;
  const savingsMinor = quote
    ? quote.quantitySavings.amountMinor + quote.noticeSavings.amountMinor
    : null;
  const orderLocked = prepared !== null;

  return (
    <main className="flow-page">
      <div className="flow-card review-card">
        <span className="eyebrow">Step 3 of 4</span>
        <h1>Review your preorder</h1>
        <div className="quote-warning" role="status">
          <strong>{reviewStatusHeading(data, preparationPhase, prepared)}</strong>
          <span>
            {preparationMessage || reviewStatusMessage(data, preparationPhase, prepared)}
          </span>
        </div>

        <section className="review-section" aria-labelledby="review-pickup">
          <div className="review-heading">
            <h2 id="review-pickup">Pickup</h2>
            <Button
              className="text-button"
              isDisabled={orderLocked}
              onPress={onKeepShopping}
            >
              Change
            </Button>
          </div>
          <p>{pickupLabel}</p>
        </section>

        <section className="review-section" aria-labelledby="review-items">
          <div className="review-heading">
            <h2 id="review-items">Your box</h2>
            <Button
              className="text-button"
              isDisabled={orderLocked}
              onPress={onKeepShopping}
            >
              Edit
            </Button>
          </div>
          <ul className="review-lines">
            {lines.map(({ product, quantity }) => (
              <li key={product.id}>
                <span>
                  <strong>{quantity}× {product.name}</strong>
                  <small>
                    {product.allergenStatus === 'unverified'
                      ? 'Allergen information is unverified'
                      : `Declared allergen information: ${product.allergens.join(', ') || 'none listed'}`}
                  </small>
                </span>
                <strong>{formatMoney({
                  currency: product.price.currency,
                  amountMinor: product.price.amountMinor * quantity
                })}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="review-section" aria-labelledby="review-contact">
          <div className="review-heading">
            <h2 id="review-contact">Pickup contact</h2>
            <Button
              className="text-button"
              isDisabled={orderLocked}
              onPress={onEditDetails}
            >
              Edit
            </Button>
          </div>
          <address>
            <strong>{customerDetails.fullName}</strong>
            <span>{customerDetails.email}</span>
            <span>{customerDetails.phone}</span>
            {customerDetails.pickupNotes && <span>{customerDetails.pickupNotes}</span>}
          </address>
        </section>

        <section className="review-section totals-section" aria-labelledby="review-total">
          <h2 id="review-total">Quote status</h2>
          <dl>
            <div>
              <dt>{quote ? 'Authoritative subtotal' : 'Draft subtotal'}</dt>
              <dd>{formatMoney(quote?.subtotal ?? {
                currency: 'USD',
                amountMinor: subtotalMinor
              })}</dd>
            </div>
            <div>
              <dt>Savings</dt>
              <dd>{savingsMinor === null
                ? 'Pending fresh quote'
                : formatMoney({
                    currency: quote?.total.currency ?? 'USD',
                    amountMinor: savingsMinor
                  })}</dd>
            </div>
            <div>
              <dt>Taxes and fees</dt>
              <dd>{quote
                ? formatMoney({
                    currency: quote.total.currency,
                    amountMinor: quote.tax.amountMinor + quote.fees.amountMinor
                  })
                : 'Pending fresh quote'}</dd>
            </div>
            <div>
              <dt>Authoritative total</dt>
              <dd>{quote ? formatMoney(quote.total) : 'Not quoted'}</dd>
            </div>
            <div>
              <dt>Quote expiry</dt>
              <dd>{quote
                ? new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  }).format(new Date(quote.expiresAt))
                : 'Not issued'}</dd>
            </div>
          </dl>
        </section>

        <section className="policy-placeholder" aria-labelledby="policy-heading">
          <h2 id="policy-heading">Pickup and cancellation policy</h2>
          <p>{data.cancellationPolicy.summary}</p>
          {!data.cancellationPolicy.customerCancellationAllowed
            && !data.cancellationPolicy.customerModificationAllowed
            && <p>Launch changes are staff-assisted; self-service controls are not available.</p>}
        </section>

        <section className="review-section payment-review" aria-labelledby="payment-review-heading">
          <h2 id="payment-review-heading">Secure checkout</h2>
          <p>
            Creating checkout saves one unpaid order first. Square receives card
            details only after you submit its secure embedded fields.
          </p>
          <SquarePaymentPanel activation={paymentActivation} />
          <PaymentOutcome
            indeterminate={paymentIndeterminate}
            payment={payment}
            onRetry={retryDeclinedPayment}
          />
        </section>

        <div className="flow-actions">
          <Button
            className="secondary-button"
            isDisabled={orderLocked}
            onPress={onEditDetails}
          >
            ← Edit details
          </Button>
          <Button
            className="primary-button"
            isDisabled={
              data.source !== 'live'
              || orderLocked
              || preparationPhase === 'preparing'
            }
            onPress={() => void prepare()}
          >
            {data.source !== 'live'
              ? 'Ordering remains disabled'
              : preparationPhase === 'preparing'
                ? 'Creating secure checkout…'
                : prepared
                  ? 'Order created'
                  : preparationPhase === 'failed'
                    ? 'Try creating checkout again'
                    : 'Create secure checkout'}
          </Button>
        </div>
      </div>
    </main>
  );
}

function PaymentOutcome({
  indeterminate,
  payment,
  onRetry
}: Readonly<{
  indeterminate: boolean;
  payment: PreorderPaymentEnvelope | null;
  onRetry: () => void;
}>) {
  if (indeterminate) {
    return (
      <p className="payment-outcome is-warning" role="status">
        We can’t confirm the payment result yet. Don’t submit again. Contact the
        shop so the same payment attempt can be reconciled.
      </p>
    );
  }
  if (!payment) return null;
  if (payment.payment_status === 'paid') {
    return (
      <p className="payment-outcome is-success" role="status">
        Payment confirmed. Your preorder is confirmed.
      </p>
    );
  }
  if (payment.payment_status === 'declined') {
    return (
      <div className="payment-outcome is-error" role="alert">
        <p>Payment was declined. Your order is not paid.</p>
        {payment.next_actions.includes('retry_payment') && (
          <Button className="secondary-button" onPress={onRetry}>
            Try a different card
          </Button>
        )}
      </div>
    );
  }
  return (
    <p className="payment-outcome is-warning" role="status">
      Payment is still processing. Don’t submit again while we confirm the result.
    </p>
  );
}

function reviewStatusHeading(
  data: PreorderFixture,
  phase: PreparationPhase,
  prepared: PreparedCheckout | null
): string {
  if (data.source !== 'live') return 'Fresh authoritative quote required';
  if (phase === 'preparing') return 'Creating your unpaid order';
  if (prepared) return 'Authoritative order created';
  if (phase === 'failed') return 'Checkout needs attention';
  return 'Ready for a fresh authoritative quote';
}

function reviewStatusMessage(
  data: PreorderFixture,
  phase: PreparationPhase,
  prepared: PreparedCheckout | null
): string {
  if (data.source !== 'live') {
    return 'Preview prices cannot be accepted or paid. The Square panel is shown in its safe inactive state.';
  }
  if (phase === 'preparing') {
    return 'We’re confirming current pricing, capacity, and the pickup policy.';
  }
  if (prepared) {
    return 'The amount below is frozen to this unpaid order. Complete payment once in the secure panel.';
  }
  return 'Create checkout to confirm current pricing and capacity before card entry appears.';
}

function customerSafePreparationMessage(error: unknown): string {
  if (error instanceof PreorderApiError) return error.message;
  if (error instanceof CheckoutPreparationError) {
    if (error.code === 'empty_cart') return 'Your box is empty.';
    if (error.code === 'capacity_unavailable') {
      return 'That pickup window no longer has enough room.';
    }
    if (error.code === 'configuration_unavailable') {
      return 'Secure checkout is not available for preview data.';
    }
  }
  return 'We couldn’t create checkout safely. Refresh the menu and review your order again.';
}
