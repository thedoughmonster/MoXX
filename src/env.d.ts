interface ImportMetaEnv {
  readonly VITE_PREORDER_API_ORIGIN?: string;
  readonly VITE_PREORDER_API_VERSION?: string;
  readonly VITE_PREORDER_DATA_MODE?: 'fixture' | 'live';
  readonly VITE_RELEASE_ID?: string;
  readonly VITE_APP_STAGE?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
