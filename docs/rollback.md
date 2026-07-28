# Rollback for moxi-web bootstrap

This contract is local-only. No hosted mutation is performed by this scaffold.

1. Disable new preorder submissions through the owning backend flag before a rollback that could strand an order/payment attempt.
2. Reconcile every pending or indeterminate order/payment through #226; never infer failure from missing client telemetry.
3. Select the last known-good exact Git commit and its accepted Cloudflare deployment version.
4. Prefer Cloudflare version rollback to that accepted version. If rebuilding is necessary, check out the exact commit, restore its lockfile, set the same public build configuration and `VITE_RELEASE_ID`, then run `pnpm install --frozen-lockfile` and `pnpm check` before deployment.
5. Verify `/health.json`, static routing, API health/CORS, Sentry release correlation, and customer routing after rollback.
6. Keep the previous externally accepted preorder path available until #167 explicitly accepts retirement.
