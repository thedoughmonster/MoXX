import {
  useEffect,
  useRef,
  useState,
  type FormEvent
} from 'react';
import { createSquareBrowserScriptHost } from './browserScriptHost';
import { loadSquareSandboxSdk } from './loadSandboxSdk';
import { mountEmbeddedSquareCard } from './mountEmbeddedCard';
import './SquarePaymentPanel.css';
import { useSquareSandboxConfig } from './squareWebPaymentsContext';
import type {
  EmbeddedSquareCard,
  SourceTokenHandoff,
  SquareChargeVerificationDetails,
  SquareSandboxPublicConfig,
  SquareSdkHost
} from './types';

export type SquarePaymentActivation =
  | Readonly<{
      status: 'inactive';
      reason: 'configuration_unavailable' | 'order_unavailable';
    }>
  | Readonly<{
      status: 'ready';
      initiationKey: string;
      verificationDetails: SquareChargeVerificationDetails;
      handoff: SourceTokenHandoff;
    }>;

type PaymentPhase =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'retryable'
  | 'indeterminate'
  | 'submitted'
  | 'unavailable';

const browserHost = () => createSquareBrowserScriptHost();
type ReadyActivation = Extract<SquarePaymentActivation, { status: 'ready' }>;

export function SquarePaymentPanel({
  activation,
  createHost = browserHost
}: Readonly<{
  activation: SquarePaymentActivation;
  createHost?: () => SquareSdkHost;
}>) {
  const config = useSquareSandboxConfig();
  if (activation.status === 'inactive') {
    return (
      <section className="square-payment-panel" aria-labelledby="square-payment-heading">
        <h2 id="square-payment-heading">Secure payment</h2>
        <p role="status">
          {activation.reason === 'configuration_unavailable'
            ? 'Payment will appear after the preorder menu is published.'
            : 'Secure payment will appear after your order is created.'}
        </p>
      </section>
    );
  }

  if (config.status === 'unavailable') {
    return (
      <section className="square-payment-panel" aria-labelledby="square-payment-heading">
        <h2 id="square-payment-heading">Secure payment</h2>
        <p role="status">Secure card entry is not available yet.</p>
      </section>
    );
  }

  if (activation.initiationKey.trim().length === 0) {
    return (
      <section className="square-payment-panel" aria-labelledby="square-payment-heading">
        <h2 id="square-payment-heading">Secure payment</h2>
        <p role="status">Secure card entry is not available yet.</p>
      </section>
    );
  }

  return (
    <ActiveSquarePaymentPanel
      key={activation.initiationKey}
      activation={activation}
      config={config.config}
      createHost={createHost}
    />
  );
}

function ActiveSquarePaymentPanel({
  activation,
  config,
  createHost
}: Readonly<{
  activation: ReadyActivation;
  config: SquareSandboxPublicConfig;
  createHost: () => SquareSdkHost;
}>) {
  const cardTarget = useRef<HTMLDivElement>(null);
  const card = useRef<EmbeddedSquareCard | undefined>(undefined);
  const [phase, setPhase] = useState<PaymentPhase>('loading');

  useEffect(() => {
    let cancelled = false;
    let mountedCard: EmbeddedSquareCard | undefined;

    const mount = async () => {
      const loaded = await loadSquareSandboxSdk(createHost());
      if (cancelled) return;
      if (loaded.status === 'unavailable' || !cardTarget.current) {
        setPhase('unavailable');
        return;
      }

      const result = await mountEmbeddedSquareCard({
        config,
        sdk: loaded.sdk,
        target: cardTarget.current
      });
      if (result.status === 'unavailable') {
        setPhase('unavailable');
        return;
      }
      mountedCard = result.card;
      if (cancelled) {
        await mountedCard.destroy();
        return;
      }
      card.current = mountedCard;
      setPhase('ready');
    };
    void mount();

    return () => {
      cancelled = true;
      card.current = undefined;
      if (mountedCard) void mountedCard.destroy();
    };
  }, [config, createHost]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!card.current || (phase !== 'ready' && phase !== 'retryable')) return;

    setPhase('submitting');
    const result = await card.current.tokenizeAndHandoff(
      activation.verificationDetails,
      activation.handoff
    );
    if (result.status === 'handed_off') {
      setPhase('submitted');
    } else if (result.status === 'retryable') {
      setPhase('retryable');
    } else if (result.status === 'indeterminate') {
      setPhase('indeterminate');
    } else if (result.reason === 'tokenization_in_progress') {
      setPhase('submitting');
    } else {
      setPhase('unavailable');
    }
  };

  const disabled = phase !== 'ready' && phase !== 'retryable';
  return (
    <section className="square-payment-panel" aria-labelledby="square-payment-heading">
      <div className="square-payment-heading">
        <div>
          <span className="square-payment-eyebrow">Embedded checkout</span>
          <h2 id="square-payment-heading">Pay securely with Square</h2>
        </div>
        <span className="square-payment-amount">
          {activation.verificationDetails.currencyCode} {activation.verificationDetails.amount}
        </span>
      </div>
      <p className="square-payment-privacy">
        Your card details are entered directly into Square’s secure fields and are
        never stored by MoXi.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <div
          className="square-card-target"
          ref={cardTarget}
          aria-label="Card details"
        />
        <button className="square-payment-submit" type="submit" disabled={disabled}>
          {buttonLabel(phase)}
        </button>
      </form>
      {phase === 'retryable' && (
        <p className="square-payment-message" role="alert">
          We couldn’t verify those card details. Check them and try again.
        </p>
      )}
      {phase === 'unavailable' && (
        <p className="square-payment-message" role="alert">
          Secure payment is temporarily unavailable. Your order has not been charged.
        </p>
      )}
      {phase === 'indeterminate' && (
        <p className="square-payment-message" role="status">
          We’re checking your payment status. Don’t submit again.
        </p>
      )}
      {phase === 'submitted' && (
        <p className="square-payment-message" role="status">
          Payment submitted. We’re confirming the result.
        </p>
      )}
    </section>
  );
}

function buttonLabel(phase: PaymentPhase): string {
  if (phase === 'loading') return 'Loading secure card fields…';
  if (phase === 'submitting') return 'Submitting securely…';
  if (phase === 'submitted' || phase === 'indeterminate') return 'Checking payment status…';
  if (phase === 'unavailable') return 'Payment unavailable';
  if (phase === 'retryable') return 'Try payment again';
  return 'Submit payment';
}
