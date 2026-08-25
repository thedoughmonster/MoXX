export type SentryLevel = 'debug' | 'info' | 'warning' | 'error';

export interface SentryContext {
  level: SentryLevel;
  source?: string;
  tags?: Record<string, string>;
}

export function initializeObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_STAGE?.trim() || 'preview',
    release: import.meta.env.VITE_RELEASE_ID?.trim() || 'local-dev',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      delete event.user;
      delete event.request;
      delete event.extra;
      event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
        category: breadcrumb.category,
        level: breadcrumb.level,
        message: breadcrumb.message,
        timestamp: breadcrumb.timestamp,
        type: breadcrumb.type
      }));
      return event;
    }
  });
}

export function captureError(error: unknown, context?: SentryContext): void {
  if (error == null) {
    return;
  }

  const safeError = new Error(error instanceof Error ? error.name : 'UnknownClientError');
  Sentry.captureException(safeError, {
    level: context?.level,
    tags: {
      source: context?.source || 'client',
      ...context?.tags
    }
  });
}
import * as Sentry from '@sentry/react';
