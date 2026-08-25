# MOX-389 validation receipt

Status: complete

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
- Playwright Chromium system dependencies installed from the pinned project
  command; no services were restarted.

## Verified results

- Root routing and static authority validation pass. UI-only, backend-only,
  root-only, and cross-product fixtures cannot skip the required product gate.
- MoMi impact planning reports product-relative paths such as `scripts/**`, not
  `MoMi/scripts/**` or `../**`, and selects the full gate with no deployment.
- The authoritative MoMi `pnpm check` contract passes in an isolated local
  clone at `174754a51e68035ed716b0457a6581ab026503e9`. The clone's local `origin`
  exposes the verified `origin/dev` (`cb4070a4...`) and `origin/prod`
  (`3e6a4f2c...`) baselines without creating or changing any GitHub remote.
- All nine MoMi hard-stop checks pass: branch cleanliness, architecture,
  service constitution, catalog, source quality, quality-report structure,
  migrations, all Edge Functions, and 1,422 tests (1,415 pass, 7 skip, 0 fail).
  The contract exits zero with its two pre-existing advisory findings reported.
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
  detached prod layout. The full `pnpm check` contract also passes its browser
  stage: 20 Playwright tests pass across four viewports and 8 operational-handoff
  tests are intentionally skipped. The exact MoXi tree `156c9273...` is shared
  by the accepted dev, prod, and validation layouts.
- Dev and prod UI build files, Worker bundles, source maps, headers, health, and
  smoke artifacts are byte-identical. Only Wrangler's generated README timestamp
  differs, as expected for separate dry-run times.
- No deployment, provider mutation, branch advance, secret write, or source
  repository change occurred.

## Access resolution

- The operator authorized loopback and external dependency access. Playwright
  could then bind `127.0.0.1:4174`, and Deno could resolve the uncached JSR
  manifest. Neither authorization allowed a deployment or provider mutation.
- The first authorized MoXi run identified missing Chromium host libraries.
  `pnpm exec playwright install-deps chromium` installed the declared packages;
  its package-manager report stated that no service needed restart. The next
  complete MoXi contract passed.
- The first full MoMi run in the authoritative draft correctly failed closed
  because it has no `origin/dev` or `origin/prod` before MOX-392, and `/tmp` is
  a different filesystem from the repository. An isolated local clone supplied
  the exact local branch baselines. A sibling ext4 temporary directory preserved
  hardlink semantics while keeping runtime receipts outside the released tree.
  No product-code change was needed, and the next full contract passed.

## Machine evidence

- Durable MoMi receipt:
  `/home/ubuntu/.local/state/openai-symphony/verification-receipts/20260825T113940Z-mox-389/momi-repository-validation-receipt.json`
- Receipt SHA-256:
  `d707a702632ab497ee1b6b2acd104ba918b8ebbb7429a0c4ad774d2ee9bb23ba`
- Preserved raw logs:
  `/home/ubuntu/.local/state/openai-symphony/verification-receipts/20260825T113940Z-mox-389/momi-run-jZGSIc/`
- MoMi result: `Validation PASS: 11 checks in 274016ms`; 9 hard-stop
  checks passed, 0 hard-stop checks failed, and 2 advisories remained visible.

## Commands with passing results

- `node scripts/validate-monorepo-automation.mjs`
- `node --test tests/*.test.mjs`
- `pnpm momi-impact plan --base dev --head HEAD`
- MoXi `pnpm check`
- MoMi `TMPDIR=<same-filesystem-sibling> pnpm check` in the isolated validation
  clone with the exact local `origin/dev` and `origin/prod` refs
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
