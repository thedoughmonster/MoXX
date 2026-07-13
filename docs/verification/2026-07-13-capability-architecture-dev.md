# Capability Architecture Dev Verification

Verified on 2026-07-13 against Supabase project `xtbraqnlskmqxinjxxdn`.

## Service Bundles

Each hosted function was deployed from its thin adapter plus service-owned
source and returned `200` from its unchanged GET probe:

| Function | Dev version | Service move commit |
| --- | ---: | --- |
| `momi-order-alert-worker-v1` | 12 | `434de6f` |
| `toast-orders-webhook-ingest-v1` | 35 | `5c144a8` |
| `toast-orders-fetch-by-guid-v1` | 29 | `0e1b03b` |
| `momi-toast-orders-get-by-id-v1` | 9 | `20d3a04` |
| `slack-order-alert-delivery-v1` | 18 | `f5abc2c` |

## Database

Dev has 47 ordered migrations. The four new service-owner migrations are:

- `20260713122321_align_hydration_service_owner`
- `20260713122421_align_order_read_service_owner`
- `20260713122429_align_order_alerting_service_owner`
- `20260713122437_align_slack_delivery_service_owner`

Hosted function and read-view registry owners match the five service manifests.
Production remains unchanged at 43 migrations pending exact-SHA promotion.

## Inventory

All five active manifest-owned functions are hosted. The two additional dev
functions are covered by unexpired retirement manifests:
`momi-orders-get-by-guid-v1` and `toast-order-alert-worker-v1`.

## Durable Flow Evidence

Dev contains three completed Toast order-to-Slack chains. Each joins a
successful owned API work item to a complete `toast_raw.orders` JSON document,
a snapshotted readable presentation, and a successful Slack delivery with a
stored Slack message receipt. The latest completed at `2026-07-13T08:27:54Z`.

Source mappings and Slack destinations have independent `is_enabled` controls.
Dev currently has two enabled source mappings and two of three destinations
enabled, with three explicit routes.

## Advisors And Tests

Supabase advisors returned 21 security and 8 performance notices, all at
informational level. The local architecture, migration, quality, Deno, and
42-test gate passed after deployment and migration reconciliation.

## Hosted Deployment Controls

Draft PR `#1` contains the nine architecture commits and its hosted validation
workflow passed. GitHub environments exist with these branch restrictions:
`dev` to `dev`, `prod` to `prod`, and `prod-promotion` to `dev`.

Supabase remains connected to `thedoughmonster/momi-backend`, but its production
deployment toggle is disabled and automatic branching remains disabled. GitHub
reports that branch protections are not enforceable for this private personal
repository and does not expose environment reviewers. The promotion workflow's
approved-PR and exact-SHA checks remain the enforceable application-level gate
until the repository moves to an organization with GitHub Team or Enterprise.
