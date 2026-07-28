import { PREORDER_API_DEFAULT_VERSION } from './config';
import { apiOrigin, preorderApiVersion } from './config';
import { type PreorderHealthEnvelope, type PreorderHealthResponse } from './contracts';

export function buildPreorderFunctionUrl(functionName: string): string {
  const normalizedName = functionName.replace(/^\//, '');
  const version = preorderApiVersion || PREORDER_API_DEFAULT_VERSION;
  return `${apiOrigin}/functions/v1/preorder-${version}/${normalizedName}`;
}

export function isHealthResponse(payload: PreorderHealthEnvelope): payload is PreorderHealthResponse {
  return payload?.ok === true;
}

export async function queryPreorderHealth(): Promise<PreorderHealthResponse> {
  const response = await fetch(buildPreorderFunctionUrl('health'), {
    method: 'GET',
    headers: {
      'content-type': 'application/json'
    },
    // No direct table access and no secret-bearing headers in this layer.
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`edge health failed: ${response.status}`);
  }

  const payload = (await response.json()) as PreorderHealthEnvelope;
  if (!isHealthResponse(payload)) {
    throw new Error('unexpected edge function response shape');
  }

  return payload;
}
