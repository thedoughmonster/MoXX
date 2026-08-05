import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import publicEnvironmentExample from '../../../.env.example?raw';
import previewHeaders from '../../../public/_headers?raw';
import appSource from '../../App.tsx?raw';
import { SquarePaymentPanel } from './SquarePaymentPanel';
import {
  SquareWebPaymentsBoundary
} from './SquareWebPaymentsBoundary';
import { squareSandboxCspContent } from './squareSandboxCsp';
import { useSquareSandboxConfig } from './squareWebPaymentsContext';

describe('Square payment UI activation boundary', () => {
  test('keeps the SDK and payment action absent while configuration is inactive', () => {
    const markup = renderToStaticMarkup(
      <SquareWebPaymentsBoundary environment={{}}>
        <SquarePaymentPanel activation={{
          status: 'inactive',
          reason: 'configuration_unavailable'
        }} />
      </SquareWebPaymentsBoundary>
    );

    expect(markup).toContain('Payment will appear after the preorder menu is published.');
    expect(markup).not.toContain('square-card-target');
    expect(markup).not.toContain('Submit payment');
  });

  test('fails closed when public Sandbox identifiers are absent', () => {
    const markup = renderToStaticMarkup(
      <SquareWebPaymentsBoundary environment={{}}>
        <SquarePaymentPanel activation={{
          status: 'ready',
          attemptKey: 'attempt-public-reference',
          verificationDetails: {
            amount: '12.34',
            currencyCode: 'USD',
            customerInitiated: true,
            intent: 'CHARGE',
            sellerKeyedIn: false
          },
          handoff: async () => undefined
        }} />
      </SquareWebPaymentsBoundary>
    );

    expect(markup).toContain('Secure card entry is not available yet.');
    expect(markup).not.toContain('Submit payment');
  });

  test('fails closed when the owner does not supply an attempt key', () => {
    const markup = renderToStaticMarkup(
      <SquareWebPaymentsBoundary environment={{
        VITE_SQUARE_SANDBOX_APPLICATION_ID: 'sandbox-sq0idb-public-example',
        VITE_SQUARE_SANDBOX_LOCATION_ID: 'SANDBOX_LOCATION'
      }}>
        <SquarePaymentPanel activation={{
          status: 'ready',
          attemptKey: ' ',
          verificationDetails: {
            amount: '12.34',
            currencyCode: 'USD',
            customerInitiated: true,
            intent: 'CHARGE',
            sellerKeyedIn: false
          },
          handoff: async () => undefined
        }} />
      </SquareWebPaymentsBoundary>
    );

    expect(markup).toContain('Secure card entry is not available yet.');
    expect(markup).not.toContain('square-card-target');
  });

  test('publishes only validated public Sandbox configuration through app context', () => {
    function ConfigProbe() {
      const config = useSquareSandboxConfig();
      return <span>{config.status}</span>;
    }
    const markup = renderToStaticMarkup(
      <SquareWebPaymentsBoundary environment={{
        VITE_SQUARE_SANDBOX_APPLICATION_ID: 'sandbox-sq0idb-public-example',
        VITE_SQUARE_SANDBOX_LOCATION_ID: 'SANDBOX_LOCATION'
      }}>
        <ConfigProbe />
      </SquareWebPaymentsBoundary>
    );
    expect(markup).toContain('ready');
  });

  test('renders embedded card entry without a popup or redirect action', () => {
    const markup = renderToStaticMarkup(
      <SquareWebPaymentsBoundary environment={{
        VITE_SQUARE_SANDBOX_APPLICATION_ID: 'sandbox-sq0idb-public-example',
        VITE_SQUARE_SANDBOX_LOCATION_ID: 'SANDBOX_LOCATION'
      }}>
        <SquarePaymentPanel activation={{
          status: 'ready',
          attemptKey: 'attempt-public-reference',
          verificationDetails: {
            amount: '12.34',
            currencyCode: 'USD',
            customerInitiated: true,
            intent: 'CHARGE',
            sellerKeyedIn: false
          },
          handoff: async () => undefined
        }} />
      </SquareWebPaymentsBoundary>
    );

    expect(markup).toContain('Pay securely with Square');
    expect(markup).toContain('square-card-target');
    expect(markup).toContain('Loading secure card fields…');
    expect(markup).not.toMatch(/href=|target=|window\.open|redirect/i);
  });

  test('is composed at the app root without loading the SDK by itself', () => {
    expect(appSource).toContain('<SquareWebPaymentsBoundary>');
    expect(appSource).not.toContain('loadSquareSandboxSdk');
  });

  test('documents only public browser identifiers', () => {
    expect(publicEnvironmentExample).toContain('VITE_SQUARE_SANDBOX_APPLICATION_ID=');
    expect(publicEnvironmentExample).toContain('VITE_SQUARE_SANDBOX_LOCATION_ID=');
    expect(publicEnvironmentExample).not.toMatch(/ACCESS_TOKEN|SIGNATURE_KEY|SECRET/);
  });
});

describe('Square Sandbox preview CSP', () => {
  test('matches the reviewed provider allowlist without production Square hosts', () => {
    expect(previewHeaders).toContain(
      `Content-Security-Policy: ${squareSandboxCspContent()}`
    );
    expect(previewHeaders).not.toContain('https://web.squarecdn.com');
    expect(previewHeaders).not.toContain('https://pci-connect.squareup.com');
  });
});
