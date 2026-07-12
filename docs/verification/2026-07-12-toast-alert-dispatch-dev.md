# Toast Alert Dispatch Dev Verification

Date: 2026-07-12

> Historical verification for commit `1ad1e3f`. ADR `0003` later removed the
> direct ingest-to-eligibility HTTP handoff. The remaining-signal section below
> is not part of the current warehouse-first architecture.

## Scope

- Git commit: `1ad1e3f`
- Git branch: `dev`
- Supabase branch project: `xtbraqnlskmqxinjxxdn`
- Production branch and production database were not changed.

## Deployment

- Migration `20260712122952_create_order_alert_dispatches` is applied.
- `toast-orders-webhook-ingest-v1` version 7 is active with JWT verification off.
- `toast-order-alert-eligibility-v1` version 4 is active with JWT verification off.
- Ingest health returned `200` with `{"ok":true}`.
- Eligibility rejected an unauthenticated request with `403 forbidden`.

## Verification

- Node `v24.18.0` passed all 6 focused tests.
- Every handwritten file is at or below 120 physical lines.
- Every TypeScript file declares at most one function.
- The migration passed a rolled-back transaction before deployment.
- The applied migration passed a second rolled-back transaction in hosted dev.
- The trigger created one pending dispatch for a synthetic raw event.
- First processing completed that dispatch with zero claims while controls were off.
- Replay returned the stored outcome without incrementing the attempt count.
- A missing raw event returned an event-not-found outcome.
- No transactional test rows persisted.

## Controls

Final hosted counts were:

- Enabled sources: 0
- Enabled rules: 0
- Enabled routes: 0
- Enabled Slack destinations: 0
- Raw events: 0
- Dispatches: 0
- Alert candidates: 0

## Advisors

Security advisors reported only expected RLS-without-policy information for
private schemas whose public, anonymous, and authenticated grants are revoked.
Performance advisors reported unused-index information expected in an empty dev
database, plus the project-level Auth connection allocation notice.

## Remaining Signal

The positive secret-key HTTP path was not forced by exposing or storing a
branch secret. The first controlled, correctly signed Toast webhook sent to dev
should confirm the ingest background handoff in Edge Function logs while all
eligibility controls remain off.
