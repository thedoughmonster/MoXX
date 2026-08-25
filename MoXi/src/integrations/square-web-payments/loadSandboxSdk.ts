import { SQUARE_SANDBOX_SDK_URL } from './constants';
import type { SquareSdkHost, SquareSdkLoadResult } from './types';

export async function loadSquareSandboxSdk(
  host: SquareSdkHost
): Promise<SquareSdkLoadResult> {
  if (!host.isSecureContext) {
    return { status: 'unavailable', reason: 'insecure_context' };
  }

  const existing = host.readSdk();
  if (existing) return { status: 'ready', sdk: existing };

  try {
    await host.loadScript(SQUARE_SANDBOX_SDK_URL);
  } catch {
    return { status: 'unavailable', reason: 'sdk_load_failed' };
  }

  const loaded = host.readSdk();
  return loaded
    ? { status: 'ready', sdk: loaded }
    : { status: 'unavailable', reason: 'sdk_missing' };
}
