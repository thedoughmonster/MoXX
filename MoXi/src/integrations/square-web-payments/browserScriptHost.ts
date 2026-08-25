import { SQUARE_SANDBOX_SDK_URL } from './constants';
import type { SquareSdk, SquareSdkHost } from './types';

const scriptSelector = 'script[data-moxi-square-web-payments]';

export function createSquareBrowserScriptHost(
  windowReference: Window = window,
  documentReference: Document = document
): SquareSdkHost {
  return {
    hostname: windowReference.location.hostname,
    isSecureContext: windowReference.isSecureContext,
    readSdk: () =>
      (windowReference as Window & { Square?: SquareSdk }).Square,
    loadScript: (source) => {
      if (source !== SQUARE_SANDBOX_SDK_URL) return Promise.reject(new Error());
      return new Promise<void>((resolve, reject) => {
        const existing = documentReference.querySelector<HTMLScriptElement>(scriptSelector);
        const script = existing ?? documentReference.createElement('script');
        if (script.dataset.moxiSquareWebPayments === 'ready') {
          resolve();
          return;
        }
        if (script.dataset.moxiSquareWebPayments === 'failed') {
          reject(new Error());
          return;
        }

        const cleanup = () => {
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
        };
        const onLoad = () => {
          script.dataset.moxiSquareWebPayments = 'ready';
          cleanup();
          resolve();
        };
        const onError = () => {
          script.dataset.moxiSquareWebPayments = 'failed';
          cleanup();
          reject(new Error());
        };
        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });

        if (!existing) {
          script.async = true;
          script.dataset.moxiSquareWebPayments = 'loading';
          script.src = source;
          documentReference.head.append(script);
        }
      });
    }
  };
}
