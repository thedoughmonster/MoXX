export const PREORDER_API_DEFAULT_ORIGIN = 'https://preorder.dough.monster';
export const PREORDER_API_DEFAULT_VERSION = 'v1';

export const runningStage = import.meta.env.VITE_APP_STAGE?.trim() || 'preview';

export const preorderApiVersion =
  import.meta.env.VITE_PREORDER_API_VERSION?.trim() || PREORDER_API_DEFAULT_VERSION;

const rawOrigin = import.meta.env.VITE_PREORDER_API_ORIGIN?.trim();
const releaseFromEnv = import.meta.env.VITE_RELEASE_ID?.trim();

const DEFAULT_ORIGIN = PREORDER_API_DEFAULT_ORIGIN;

function normalizeOrigin(candidate: string | undefined): string | null {
  if (!candidate) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

export const apiOrigin =
  normalizeOrigin(rawOrigin) ?? (typeof window !== 'undefined'
    ? window.location.origin
    : DEFAULT_ORIGIN);

export const releaseIdentity = releaseFromEnv || 'local-dev';

export const healthEndpoint = `${apiOrigin}/functions/v1/preorder-${preorderApiVersion}/health`;
