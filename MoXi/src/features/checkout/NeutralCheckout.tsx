import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import type { CheckoutClient } from './client';
import type {
  CheckoutHandoff,
  CheckoutNextAction,
  CheckoutReference
} from './contracts';

const stateCopy: Record<CheckoutReference['status']['customer_state'], Readonly<{ title: string; body: string }>> = {
  loading: { title: 'Loading checkout', body: 'Retrieving the current checkout state.' },
  empty: { title: 'Your cart is empty', body: 'Add an item before starting checkout.' },
  incomplete: { title: 'Checkout needs information', body: 'Complete the current step to continue.' },
  ready: { title: 'Payment is required', body: 'Review the authoritative total before continuing to payment.' },
  invalid: { title: 'Checkout needs attention', body: 'The cart cannot continue in its current state.' },
  stale: { title: 'Checkout changed', body: 'Refresh the authoritative details before continuing.' },
  pending: { title: 'Payment is pending', body: 'Do not submit another payment while status is being confirmed.' },
  declined: { title: 'Payment was declined', body: 'No confirmation was created. You can try payment again.' },
  indeterminate: { title: 'Payment status is uncertain', body: 'Do not pay again. Recover the existing attempt first.' },
  recovery_required: { title: 'Recovery is required', body: 'Check the existing payment result before taking another action.' },
  confirmed: { title: 'Order confirmed', body: 'Checkout authority reports that payment is complete.' }
};

const actionLabels: Record<CheckoutNextAction, string> = {
  refresh: 'Refresh checkout',
  edit_cart: 'Return to cart',
  provide_contact: 'Save contact details',
  confirm_fulfillment: 'Confirm fulfillment',
  retry_revalidation: 'Check details again',
  initiate_payment: 'Continue to payment',
  retry_payment: 'Try another payment',
  recover: 'Recover payment status',
  view_confirmation: 'View confirmation',
  contact_shop: 'Contact the shop'
};

export function NeutralCheckout({
  client,
  handoff
}: Readonly<{ client: CheckoutClient; handoff: CheckoutHandoff | null }>) {
  const [snapshot, setSnapshot] = useState<CheckoutReference | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!handoff) return;
    let active = true;
    void client.load(handoff).then((next) => {
      if (active) setSnapshot(next);
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [client, handoff]);

  useEffect(() => {
    if (snapshot) heading.current?.focus();
  }, [snapshot]);

  if (!handoff) {
    return <CheckoutShell><Status title="Checkout link is incomplete" body="Return to the cart and start checkout again." assertive /></CheckoutShell>;
  }
  if (loadError) {
    return <CheckoutShell><Status title="Checkout is unavailable" body="Your cart is safe. Try loading checkout again." assertive /></CheckoutShell>;
  }
  if (!snapshot) {
    return <CheckoutShell><Status title="Loading checkout" body="Retrieving the current checkout state." /></CheckoutShell>;
  }

  const { status, review } = snapshot;
  const copy = stateCopy[status.customer_state];
  const showContact = status.phase === 'contact';
  const announceAssertively = ['invalid', 'stale', 'declined', 'indeterminate', 'recovery_required']
    .includes(status.customer_state);

  const act = async (action: CheckoutNextAction) => {
    if (action === 'edit_cart') {
      window.location.assign('/');
      return;
    }
    setBusy(true);
    try {
      setSnapshot(await client.act(handoff, action));
    } finally {
      setBusy(false);
    }
  };

  const saveContactAndFulfillment = async () => {
    setBusy(true);
    try {
      await client.act(handoff, 'provide_contact');
      setSnapshot(await client.act(handoff, 'confirm_fulfillment'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CheckoutShell>
      <header className="checkout-heading">
        <p className="checkout-kicker">Canonical checkout reference</p>
        <h1 ref={heading} tabIndex={-1}>{copy.title}</h1>
        <p>{copy.body}</p>
      </header>

      <div className="checkout-status" role={announceAssertively ? 'alert' : 'status'} aria-live={announceAssertively ? 'assertive' : 'polite'}>
        <strong>{status.phase.replace('_', ' ')}</strong>
        <span>State: {status.customer_state.replace('_', ' ')}</span>
        {status.issues.map((item) => <p key={item.code}>{item.message}</p>)}
      </div>

      <section aria-labelledby="review-heading" className="checkout-section">
        <h2 id="review-heading">Review</h2>
        <ul className="checkout-lines">
          {review.lines.map((line) => (
            <li key={line.line_id}>
              <span><strong>{line.quantity} × {line.name}</strong><small>{line.detail}</small></span>
              <Money amount={line.total.amount_minor} currency={line.total.currency} />
            </li>
          ))}
        </ul>
      </section>

      {showContact && (
        <form className="checkout-section checkout-form" onSubmit={(event) => { event.preventDefault(); void saveContactAndFulfillment(); }}>
          <h2>Customer contact</h2>
          <label>Name <input name="name" autoComplete="name" required /></label>
          <label>Email <input name="email" type="email" autoComplete="email" required /></label>
          <label>Phone <input name="phone" type="tel" autoComplete="tel" /></label>
          <label className="checkout-confirmation">
            <input name="fulfillment-confirmed" type="checkbox" required />
            <span>Confirm this fulfillment selection: {review.fulfillment_summary}</span>
          </label>
          <Button type="submit" className="checkout-primary" isDisabled={busy}>Save contact details</Button>
        </form>
      )}

      <section aria-labelledby="fulfillment-heading" className="checkout-section">
        <h2 id="fulfillment-heading">Fulfillment</h2>
        <p>{review.fulfillment_summary}</p>
        {review.disclosures.map((item) => <p className="checkout-disclosure" key={item}>{item}</p>)}
      </section>

      <section aria-labelledby="totals-heading" className="checkout-section">
        <h2 id="totals-heading">Totals and holds</h2>
        <dl className="checkout-totals">
          {review.totals.map((total) => <div key={total.key}><dt>{total.label}</dt><dd><Money amount={total.amount.amount_minor} currency={total.amount.currency} /></dd></div>)}
        </dl>
        <p className="checkout-disclosure">{review.hold_summary}</p>
      </section>

      {!showContact && (
        <div className="checkout-actions" aria-label="Checkout actions">
          {status.next_actions.map((action) => (
            <Button key={action} className="checkout-primary" isDisabled={busy || status.customer_state === 'loading'} onPress={() => void act(action)}>
              {busy ? 'Working…' : actionLabels[action]}
            </Button>
          ))}
        </div>
      )}
      <p className="checkout-reference">Reference: {status.order_id.slice(0, 8)} · version {status.order_version}</p>
    </CheckoutShell>
  );
}

function CheckoutShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="checkout-page"><div className="checkout-card">{children}</div></main>;
}

function Status({ title, body, assertive = false }: Readonly<{ title: string; body: string; assertive?: boolean }>) {
  return <div role={assertive ? 'alert' : 'status'}><h1>{title}</h1><p>{body}</p></div>;
}

function Money({ amount, currency }: Readonly<{ amount: number; currency: string }>) {
  return <>{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)}</>;
}
