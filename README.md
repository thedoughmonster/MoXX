# moxi-web

Production-shaped local bootstrap for `preorder.dough.monster`.

## Scope

- Strict TypeScript React + Vite application.
- Cloudflare Worker with static asset delivery.
- Versioned Supabase Edge Function boundary only (`preorder-<version>/<fn>`).
- No table access from browser clients.
- Opt-in Sentry client initialization when a public DSN is intentionally provided; no replay or customer/payment payload capture.
- Deterministic local checks and CI-ready workflow.

## Local commands

- `pnpm install --frozen-lockfile`
- `pnpm run check`
- `pnpm run worker:types`
- `pnpm run dev`

`check` includes `typecheck`, `test`, and `build` in a single deterministic pass.

## Runtime contract

- API client uses the exact public Supabase project origin supplied as `VITE_PREORDER_API_ORIGIN`.
- API contract version:
  - `VITE_PREORDER_API_VERSION` (defaults to `v1`)
- Edge function endpoint format:
  - `/functions/v1/preorder-<version>/<route>`
- Browser integration never uses table paths or direct DB queries.
- `VITE_PREORDER_EXPERIENCE_MODE=toast_handoff` activates the bounded launch
  fallback and requires an HTTPS `VITE_PREORDER_CHECKOUT_URL`. It displays no
  fixture menu and sends checkout to the existing live provider path.

## Static health/smoke

- `/health` -> resolved by worker to `/health.json`
- `/smoke` -> resolved by worker to `/smoke.json`
- Health/smoke are intended as CI and deployment smoke checks.

## Hosting configuration

- `wrangler.jsonc` includes only the exact production custom domain:
  - `preorder.dough.monster`
- Deploy named environments explicitly; do not deploy the root Worker configuration.
- `APP_STAGE` sets indexing behavior:
  - `preview` adds `X-Robots-Tag: noindex, nofollow`
  - `production` does not force no-indexing.

## Release identity

- Set `VITE_RELEASE_ID` at build time (CI sets this to commit SHA) to surface immutable build identity in the UI and generated `/health.json` and `/smoke.json` assets.

## Rollback

See `docs/rollback.md`.
