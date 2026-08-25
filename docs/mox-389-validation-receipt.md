# MOX-389 validation receipt

Status: blocked, not complete

## Identity

- Validation branch: `mox-389-validate-layouts`
- Monorepo automation base: `e91bce1edab869662ae3249c4247579bb0039311`
- Layout adaptation commit: `f3870d1ea5e026c5b7622e90e15dee644f19c6a2`
- Imported MoMi dev source: `f52215975104aa8448f9cad4a05945ffe8282b46`
- Imported MoMi prod source: `9b2addfcbb99c8f5d83276b4d6475d302b4c8de6`
- Imported MoXi source: `74279ef82c4759c50021eba5bccb8d21f2749978`
- Local dev layout: `cb4070a4d1b0918c96f602ef50e94d9218c23c32`
- Local prod layout: `3e6a4f2c1a896c69998f6a658f2a38225abfbd59`

## Environment

- Node `v24.14.0`
- Git `2.53.0`
- MoMi pnpm `11.7.0`, Deno `2.9.2`
- MoXi pnpm `10.0.0`, Wrangler `4.114.0`

## Verified results

- Root routing and static authority validation pass. UI-only, backend-only,
  root-only, and cross-product fixtures cannot skip the required product gate.
- MoMi impact planning reports product-relative paths such as `scripts/**`, not
  `MoMi/scripts/**` or `../**`, and selects the full gate with no deployment.
- MoMi architecture (29 services, 39 functions), constitution and debt ratchets,
  generated service catalog, source quality, quality-report structure, and
  migration validation pass.
- The migration validator resolves the exact imported source histories and
  verifies 250 production migrations. Dev contains 302 migrations; the dev and
  prod migration tree hashes exactly equal their accepted source trees.
- The accepted dev and prod product trees exactly match the migration manifest:
  MoMi trees `83f55e25...` and `1e33cf6d...`; MoXi tree `156c9273...` in both.
- MoXi lint, typecheck, generated Worker types, 29 unit tests, production build,
  and Cloudflare preview/production dry-runs pass from both dev and a clean
  detached prod layout.
- Dev and prod UI build files, Worker bundles, source maps, headers, health, and
  smoke artifacts are byte-identical. Only Wrangler's generated README timestamp
  differs, as expected for separate dry-run times.
- No deployment, provider mutation, branch advance, secret write, or source
  repository change occurred.

## Blocking results

- `pnpm check` in `MoXi/` reaches Playwright after all earlier stages pass, then
  the sandbox rejects its loopback server with `listen EPERM 127.0.0.1:4174`.
  Two bounded requests to run the check with loopback access timed out in the
  automatic approval reviewer, so no passing end-to-end result exists.
- The MoMi final gate reaches Edge Function validation, then Deno cannot fetch
  the uncached `https://jsr.io/@supabase/functions-js/meta.json` manifest in the
  restricted network environment. This is an external-access failure, not a
  passing Edge Function check.
- Because both product contracts have not passed in full, this receipt does not
  satisfy MOX-389 acceptance criterion 1 and MOX-389 remains In Progress.

## Commands with passing results

- `node scripts/validate-monorepo-automation.mjs`
- `node --test tests/*.test.mjs`
- `pnpm momi-impact plan --base dev --head HEAD`
- `node scripts/check_architecture.ts`
- `node scripts/check_service_constitution.ts`
- `node scripts/check_catalog.ts`
- `node scripts/check_source_quality.ts`
- `node scripts/check_quality_report_validity.ts`
- `node scripts/check_migrations.ts`
- Focused migration, authority projection, source-quality, and hook regression
  tests recorded in the local execution log
- MoXi `pnpm lint`, `pnpm typecheck`, `pnpm worker:types:check`, `pnpm test`,
  `pnpm build`, and `pnpm cloudflare:dry-run` in dev and detached prod layouts
