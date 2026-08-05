import {
  SQUARE_SANDBOX_APPLICATION_ID_KEY,
  SQUARE_SANDBOX_LOCATION_ID_KEY
} from './constants';
import type { SquareSandboxConfigResult } from './types';

const sandboxApplicationId = /^sandbox-sq0idb-[A-Za-z0-9_-]{8,128}$/;
const locationId = /^[A-Za-z0-9_-]{2,64}$/;

export function readSquareSandboxConfig(
  environment: Readonly<Record<string, unknown>>
): SquareSandboxConfigResult {
  const applicationId = environment[SQUARE_SANDBOX_APPLICATION_ID_KEY];
  const configuredLocationId = environment[SQUARE_SANDBOX_LOCATION_ID_KEY];
  if (typeof applicationId !== 'string' || typeof configuredLocationId !== 'string') {
    return { status: 'unavailable', reason: 'configuration_missing' };
  }

  const normalizedApplicationId = applicationId.trim();
  const normalizedLocationId = configuredLocationId.trim();
  if (
    !sandboxApplicationId.test(normalizedApplicationId) ||
    !locationId.test(normalizedLocationId)
  ) {
    return { status: 'unavailable', reason: 'configuration_invalid' };
  }

  return {
    status: 'ready',
    config: {
      applicationId: normalizedApplicationId,
      locationId: normalizedLocationId
    }
  };
}
