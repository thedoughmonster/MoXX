# Toast Source Channel Routing Dev Verification

- Date: 2026-07-12
- Environment: persistent Supabase `dev` branch
- Result: passed
- Production changed: no

## Slack Channels

- Private `momi-dev-in-store-orders`: `C0BGX9965S8`
- Private `momi-dev-out-of-store-orders`: `C0BGVFER8U9`
- Slack app in both channels: `Dough Monster Ops`

## Source Routing

- `toast_in_store` uses `equals` with `source = "In Store"`.
- `toast_out_of_store` uses `not_equals` with `source = "In Store"`.
- A missing or JSON `null` source matches neither source.
- Each source, rule, route, and destination has an independent enabled flag.
- Legacy destination `momi_dev_alerts` remains stored but is disabled.

## Dev Destinations

- `toast_in_store` routes to `momi_dev_in_store_orders`.
- `toast_out_of_store` routes to `momi_dev_out_of_store_orders`.
- Both new routes and destinations are enabled.

## Database Verification

Migration history records:

- `20260712182744_add_toast_source_match_operators`
- `20260712182751_update_raw_alert_claim_source_matching`
- `20260712182801_update_hydrated_alert_claim_source_matching`

A rolled-back migration test verified `equals`, `not_equals`, missing source,
and JSON `null` behavior before the migrations were applied.

A read-only classification query checked both stored hydrated orders:

- `In Store` order `b6edc62f-3776-4ee5-8ae4-a500194e21d1` matched only
  `momi_dev_in_store_orders`.
- `Kiosk` order `643b1551-d38a-4b82-85e8-4b086fe4a967` matched only
  `momi_dev_out_of_store_orders`.

The query produced two eligible orders and two route matches. No candidate,
delivery work, or Slack message was created during routing verification.

## Repository Verification

- Node: `24.14.0`
- Tests: `20` passed, `0` failed
- Handwritten files: all at or below `120` lines
- Supabase advisors: no security or performance warnings or errors
