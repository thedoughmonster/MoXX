import { describe, expect, test, vi } from 'vitest';
import browserScriptHostSource from './browserScriptHost.ts?raw';
import { SQUARE_SANDBOX_SDK_URL } from './constants';
import loadSandboxSdkSource from './loadSandboxSdk.ts?raw';
import { loadSquareSandboxSdk } from './loadSandboxSdk';
import mountEmbeddedCardSource from './mountEmbeddedCard.ts?raw';
import { mountEmbeddedSquareCard } from './mountEmbeddedCard';
import readSandboxConfigSource from './readSandboxConfig.ts?raw';
import squarePaymentPanelSource from './SquarePaymentPanel.tsx?raw';
import squareWebPaymentsBoundarySource from './SquareWebPaymentsBoundary.tsx?raw';
import { readSquareSandboxConfig } from './readSandboxConfig';
import type {
  SquareCard,
  SquareChargeVerificationDetails,
  SquareSdk,
  SquareSdkHost,
  SquareTokenizeResult
} from './types';

const publicConfig = {
  applicationId: 'sandbox-sq0idb-public-example',
  locationId: 'SANDBOX_LOCATION'
} as const;

const verificationDetails: SquareChargeVerificationDetails = {
  amount: '12.34',
  currencyCode: 'USD',
  customerInitiated: true,
  intent: 'CHARGE',
  sellerKeyedIn: false
};

function fakeSdk(card: SquareCard): SquareSdk {
  return { payments: vi.fn(() => ({ card: async () => card })) };
}

function fakeCard(result: Awaited<ReturnType<SquareCard['tokenize']>>): SquareCard {
  return {
    attach: vi.fn(async () => undefined),
    destroy: vi.fn(async () => true),
    tokenize: vi.fn(async () => result)
  };
}

describe('Square Sandbox public configuration', () => {
  test('accepts only explicit Sandbox application and location identifiers', () => {
    expect(readSquareSandboxConfig({
      VITE_SQUARE_SANDBOX_APPLICATION_ID: publicConfig.applicationId,
      VITE_SQUARE_SANDBOX_LOCATION_ID: publicConfig.locationId
    })).toEqual({ status: 'ready', config: publicConfig });
    expect(readSquareSandboxConfig({
      VITE_SQUARE_SANDBOX_APPLICATION_ID: 'production-application',
      VITE_SQUARE_SANDBOX_LOCATION_ID: publicConfig.locationId
    })).toEqual({ status: 'unavailable', reason: 'configuration_invalid' });
  });
});

describe('Square Sandbox SDK loader', () => {
  test('loads only the fixed Sandbox SDK in a secure context', async () => {
    const sdk = fakeSdk(fakeCard({ status: 'FAILED' }));
    const host: SquareSdkHost = {
      hostname: 'preorder.example.test',
      isSecureContext: true,
      loadScript: vi.fn(async (source) => {
        expect(source).toBe(SQUARE_SANDBOX_SDK_URL);
      }),
      readSdk: vi.fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(sdk)
    };
    expect(await loadSquareSandboxSdk(host)).toEqual({ status: 'ready', sdk });
    expect(host.loadScript).toHaveBeenCalledTimes(1);
  });

  test('fails closed before loading in an insecure context', async () => {
    const host: SquareSdkHost = {
      hostname: 'preorder.example.test',
      isSecureContext: false,
      loadScript: vi.fn(),
      readSdk: vi.fn()
    };
    expect(await loadSquareSandboxSdk(host)).toEqual({
      status: 'unavailable',
      reason: 'insecure_context'
    });
    expect(host.loadScript).not.toHaveBeenCalled();
  });
});

describe('embedded Square card token handoff', () => {
  test('hands one token directly to Logic and never returns it', async () => {
    const sensitiveValue = crypto.randomUUID();
    const providerCard = fakeCard({ status: 'OK', token: sensitiveValue });
    const mounted = await mountEmbeddedSquareCard({
      config: publicConfig,
      sdk: fakeSdk(providerCard),
      target: {} as HTMLElement
    });
    expect(mounted.status).toBe('ready');
    if (mounted.status !== 'ready') return;

    const handoff = vi.fn(async () => undefined);
    const first = await mounted.card.tokenizeAndHandoff(verificationDetails, handoff);
    const duplicate = await mounted.card.tokenizeAndHandoff(verificationDetails, handoff);
    expect(first).toEqual({ status: 'handed_off' });
    expect(JSON.stringify(first)).not.toContain(sensitiveValue);
    expect(handoff).toHaveBeenCalledOnce();
    expect(handoff).toHaveBeenCalledWith(sensitiveValue);
    expect(duplicate).toEqual({
      status: 'blocked',
      reason: 'token_already_handed_off'
    });
    expect(providerCard.tokenize).toHaveBeenCalledOnce();
  });

  test('makes an ambiguous Logic handoff indeterminate and non-repeatable', async () => {
    const providerCard = fakeCard({ status: 'OK', token: crypto.randomUUID() });
    const mounted = await mountEmbeddedSquareCard({
      config: publicConfig,
      sdk: fakeSdk(providerCard),
      target: {} as HTMLElement
    });
    if (mounted.status !== 'ready') throw new Error('fixture mount failed');

    const first = await mounted.card.tokenizeAndHandoff(
      verificationDetails,
      async () => Promise.reject(new Error())
    );
    const duplicate = await mounted.card.tokenizeAndHandoff(
      verificationDetails,
      async () => undefined
    );
    expect(first).toEqual({
      status: 'indeterminate',
      reason: 'source_token_handoff_indeterminate'
    });
    expect(duplicate).toEqual({
      status: 'blocked',
      reason: 'token_already_handed_off'
    });
  });

  test('blocks concurrent duplicate submission while tokenization is in progress', async () => {
    let releaseTokenization!: (result: SquareTokenizeResult) => void;
    const providerCard: SquareCard = {
      attach: vi.fn(async () => undefined),
      destroy: vi.fn(async () => true),
      tokenize: vi.fn(() => new Promise<SquareTokenizeResult>((resolve) => {
        releaseTokenization = resolve;
      }))
    };
    const mounted = await mountEmbeddedSquareCard({
      config: publicConfig,
      sdk: fakeSdk(providerCard),
      target: {} as HTMLElement
    });
    if (mounted.status !== 'ready') throw new Error('fixture mount failed');

    const first = mounted.card.tokenizeAndHandoff(
      verificationDetails,
      async () => undefined
    );
    expect(await mounted.card.tokenizeAndHandoff(
      verificationDetails,
      async () => undefined
    )).toEqual({ status: 'blocked', reason: 'tokenization_in_progress' });
    releaseTokenization({ status: 'FAILED' });
    await expect(first).resolves.toEqual({
      status: 'retryable',
      reason: 'tokenization_failed'
    });
    expect(providerCard.tokenize).toHaveBeenCalledOnce();
  });

  test('sanitizes provider failures without exposing provider details', async () => {
    const providerCard = fakeCard({
      status: 'FAILED',
      errors: [{ message: 'provider-only detail' }]
    });
    const mounted = await mountEmbeddedSquareCard({
      config: publicConfig,
      sdk: fakeSdk(providerCard),
      target: {} as HTMLElement
    });
    if (mounted.status !== 'ready') throw new Error('fixture mount failed');

    const result = await mounted.card.tokenizeAndHandoff(
      verificationDetails,
      async () => undefined
    );
    expect(result).toEqual({ status: 'retryable', reason: 'tokenization_failed' });
    expect(JSON.stringify(result)).not.toContain('provider-only detail');
  });

  test('contains no storage, logging, payment call, popup, or redirect path', () => {
    const source = [
      browserScriptHostSource,
      loadSandboxSdkSource,
      mountEmbeddedCardSource,
      readSandboxConfigSource,
      squarePaymentPanelSource,
      squareWebPaymentsBoundarySource
    ].join('\n');
    expect(source).not.toMatch(
      /localStorage|sessionStorage|console\.|fetch\(|sendBeacon|Sentry|window\.open/
    );
    expect(source).not.toMatch(/location\.(?:assign|replace)|connect\.squareup/);
  });
});
