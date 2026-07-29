export const PREORDER_API_DEFAULT_ORIGIN = 'https://preorder.dough.monster';
export const PREORDER_API_DEFAULT_VERSION = 'v1';

export const runningStage = import.meta.env.VITE_APP_STAGE?.trim() || 'preview';

export const preorderExperienceMode =
  import.meta.env.VITE_PREORDER_EXPERIENCE_MODE?.trim() === 'toast_handoff'
    ? 'toast_handoff'
    : 'first_party';

const rawCheckoutUrl = import.meta.env.VITE_PREORDER_CHECKOUT_URL?.trim();

export const preorderCheckoutUrl = (() => {
  if (!rawCheckoutUrl) return null;
  try {
    const url = new URL(rawCheckoutUrl);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
})();

export const preorderApiVersion =
  import.meta.env.VITE_PREORDER_API_VERSION?.trim() || PREORDER_API_DEFAULT_VERSION;

const requestedDataMode = import.meta.env.VITE_PREORDER_DATA_MODE?.trim();

export const preorderDataMode =
  runningStage !== 'production' && requestedDataMode === 'fixture' ? 'fixture' : 'live';

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
