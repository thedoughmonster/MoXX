import { apiOrigin } from './config';
import {
  preorderBootstrapEnvelope,
  type PreorderBootstrapEnvelope
} from './contracts';

export class PreorderApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PreorderApiError';
  }
}

export function buildPreorderBootstrapUrl(surfaceKey = 'preorder'): string {
  const url = new URL('/functions/v1/momi-preorder-bootstrap-v1', apiOrigin);
  url.searchParams.set('surface_key', surfaceKey);
  return url.toString();
}

export async function queryPreorderBootstrap(): Promise<PreorderBootstrapEnvelope> {
  const response = await fetch(buildPreorderBootstrapUrl(), {
    method: 'GET',
    headers: {
      accept: 'application/json'
    },
    credentials: 'omit'
  });

  if (!response.ok) {
    const message = response.status === 409
      ? 'Preorders are not published yet.'
      : `Preorder service returned ${response.status}.`;
    throw new PreorderApiError(message, response.status);
  }

  return preorderBootstrapEnvelope.parse(await response.json());
}
