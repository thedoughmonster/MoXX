import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import {
  createCommandRequest,
  createRecoveryRequest,
  createStatusRequest,
  type CheckoutClient
} from './client';
import type {
  CheckoutHandoff,
  CheckoutNextAction,
  CheckoutReference,
  CustomerContact
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
}: Readonly<{ client: CheckoutClient | null; handoff: CheckoutHandoff | null }>) {
  const [snapshot, setSnapshot] = useState<CheckoutReference | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!handoff || !client) return;
    let active = true;
    void client.load(createStatusRequest(handoff)).then((next) => {
      if (active) setSnapshot(next);
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [client, handoff, loadAttempt]);

  useEffect(() => {
    if (snapshot) heading.current?.focus();
  }, [snapshot]);

  if (!handoff) {
    return <CheckoutShell><Status title="Checkout link is incomplete" body="Return to the cart and start checkout again." assertive /></CheckoutShell>;
  }
  if (!client) {
    return <CheckoutShell><Status title="Checkout is not connected" body="Return to the cart and try again when checkout is available." assertive /></CheckoutShell>;
  }
  if (loadError) {
    return (
      <CheckoutShell>
        <Status title="Checkout is unavailable" body="Your cart is safe. Try loading checkout again." assertive />
        <Button className="checkout-primary" onPress={() => {
          setLoadError(false);
          setLoadAttempt((attempt) => attempt + 1);
        }}>
          Try loading again
        </Button>
      </CheckoutShell>
    );
  }
  if (!snapshot) {
    return <CheckoutShell><Status title="Loading checkout" body="Retrieving the current checkout state." /></CheckoutShell>;
  }

  const { status, review } = snapshot;
  const copy = stateCopy[status.customer_state];
  const showContact = status.phase === 'contact';
  const announceAssertively = ['invalid', 'stale', 'declined', 'indeterminate', 'recovery_required']
    .includes(status.customer_state);

  const runOperation = async (operation: () => Promise<CheckoutReference>) => {
    setBusy(true);
    setOperationError(false);
    try {
      setSnapshot(await operation());
    } catch {
      setOperationError(true);
    } finally {
      setBusy(false);
    }
  };

  const act = (action: CheckoutNextAction) => {
    if (action === 'edit_cart') {
      window.location.assign('/');
      return;
    }
    if (action === 'view_confirmation') {
      heading.current?.focus();
      return;
    }
    if (action === 'contact_shop' || action === 'provide_contact' || action === 'confirm_fulfillment') {
      setOperationError(true);
      return;
    }
    void runOperation(() => {
      if (action === 'refresh') return client.load(createStatusRequest(handoff));
      if (action === 'recover') {
        return client.recover(createRecoveryRequest(
          handoff,
          status.order_version,
          status.checkout_version,
          crypto.randomUUID()
        ));
      }
      const commandAction = action === 'retry_revalidation'
        ? 'revalidate'
        : action === 'initiate_payment'
          ? 'place'
          : 'resume';
      return client.command(createCommandRequest(
        handoff,
        status.order_version,
        crypto.randomUUID(),
        { action: commandAction }
      ));
    });
  };

  const saveContactAndFulfillment = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const phone = String(data.get('phone') ?? '').trim();
    const contact: CustomerContact = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      ...(phone ? { phone } : {})
    };
    void runOperation(async () => {
      const afterContact = await client.command(createCommandRequest(
        handoff,
        status.order_version,
        crypto.randomUUID(),
        { action: 'save_contact', contact }
      ));
      // Keep every successful authority response, even if the next command fails.
      setSnapshot(afterContact);
      return client.command(createCommandRequest(
        handoff,
        afterContact.status.order_version,
        crypto.randomUUID(),
        { action: 'confirm_fulfillment', fulfillment_ref: afterContact.review.fulfillment_ref }
      ));
    });
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
        <form className="checkout-section checkout-form" onSubmit={(event) => { event.preventDefault(); saveContactAndFulfillment(event.currentTarget); }}>
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
            <Button key={action} className="checkout-primary" isDisabled={busy} onPress={() => act(action)}>
              {busy ? 'Working…' : actionLabels[action]}
            </Button>
          ))}
        </div>
      )}
      {operationError && (
        <div className="checkout-operation-error" role="alert">
          <p>Checkout could not complete that action. Your cart is safe; try again.</p>
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
