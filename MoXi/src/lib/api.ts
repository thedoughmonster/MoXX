import { type ZodType } from 'zod';
import { apiOrigin } from './config';
import {
  preorderBootstrapEnvelope,
  preorderHoldEnvelope,
  preorderOrderIntentEnvelope,
  preorderPaymentEnvelope,
  preorderQuoteEnvelope,
  type HoldRequest,
  type OrderIntentRequest,
  type PaymentInitiateRequest,
  type PreorderBootstrapEnvelope,
  type PreorderHoldEnvelope,
  type PreorderOrderIntentEnvelope,
  type PreorderPaymentEnvelope,
  type PreorderQuoteEnvelope,
  type QuoteRequest
} from './contracts';

export class PreorderApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PreorderApiError';
  }
}

function buildPreorderFunctionUrl(functionName: string): string {
  return new URL(`/functions/v1/${functionName}`, apiOrigin).toString();
}

export function buildPreorderBootstrapUrl(surfaceKey = 'preorder'): string {
  const url = new URL(buildPreorderFunctionUrl('momi-preorder-bootstrap-v1'));
  url.searchParams.set('surface_key', surfaceKey);
  return url.toString();
}

export function buildPreorderPaymentInitiateUrl(): string {
  return buildPreorderFunctionUrl('momi-preorder-payment-initiate-v1');
}

async function readResponse<T>(
  response: Response,
  schema: ZodType<T>
): Promise<T> {
  if (!response.ok) {
    const message = response.status === 409
      ? 'Your preorder changed. Refresh and review it again.'
      : response.status === 429
        ? 'Too many requests. Wait a moment and try again.'
        : `Preorder service returned ${response.status}.`;
    throw new PreorderApiError(message, response.status);
  }
  return schema.parse(await response.json());
}

async function postPreorder<T>(
  functionName: string,
  body: unknown,
  schema: ZodType<T>,
  authority?: Readonly<{ header: string; value: string }>
): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json'
  };
  if (authority) headers[authority.header] = authority.value;

  const response = await fetch(buildPreorderFunctionUrl(functionName), {
    method: 'POST',
    headers,
    credentials: 'omit',
    body: JSON.stringify(body)
  });
  return readResponse(response, schema);
}

export async function queryPreorderBootstrap(): Promise<PreorderBootstrapEnvelope> {
  const response = await fetch(buildPreorderBootstrapUrl(), {
    method: 'GET',
    headers: {
      accept: 'application/json'
    },
    credentials: 'omit'
  });
  return readResponse(response, preorderBootstrapEnvelope);
}

export function createPreorderQuote(
  request: QuoteRequest
): Promise<PreorderQuoteEnvelope> {
  return postPreorder(
    'momi-preorder-quote-v1',
    request,
    preorderQuoteEnvelope
  );
}

export function createPreorderCheckoutHold(
  request: HoldRequest,
  checkoutAuthority: string
): Promise<PreorderHoldEnvelope> {
  return postPreorder(
    'momi-preorder-checkout-hold-v1',
    request,
    preorderHoldEnvelope,
    { header: 'X-MoMi-Checkout-Authority', value: checkoutAuthority }
  );
}

export function createPreorderOrderIntent(
  request: OrderIntentRequest,
  checkoutAuthority: string
): Promise<PreorderOrderIntentEnvelope> {
  return postPreorder(
    'momi-preorder-order-intent-v1',
    request,
    preorderOrderIntentEnvelope,
    { header: 'X-MoMi-Checkout-Authority', value: checkoutAuthority }
  );
}

export function initiatePreorderPayment(
  request: PaymentInitiateRequest,
  recoveryAuthority: string
): Promise<PreorderPaymentEnvelope> {
  return postPreorder(
    'momi-preorder-payment-initiate-v1',
    request,
    preorderPaymentEnvelope,
    { header: 'X-MoMi-Recovery-Authority', value: recoveryAuthority }
  );
}
