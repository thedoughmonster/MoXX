# 0017: Curated Shop Analysis SQL

- Status: accepted
- Date: 2026-07-22

## Context

The communications beta can read one canonical record only when the model
already knows its internal UUID. That cannot answer natural operational
questions such as a daily shop rundown, compare sales channels, or summarize
labor and payments. Adding one bespoke endpoint per question would recreate a
report API for every conversation and keep the model dependent on internal IDs.

## Decision

`warehouse-read-api` owns `momi.shop_analysis_query.v1`: a curated relational
projection of shop operations plus one bounded query executor. The projection
contains business dates, order totals and item lines, payments, menu facts,
schedules, and non-identifying labor facts. It excludes customer identity,
employee identity, source payloads, auth data, communications, and private
operational tables.

`communications-gateway` may submit one model-produced PostgreSQL `SELECT`
through this contract. It must parse exactly one statement, allow only the
contract catalog and safe analytical functions, cap text, time, rows, and
serialized bytes, and execute in a read-only transaction after assuming the
non-login `svc_communications_gateway` role. PostgreSQL grants, not prompting,
are the final access boundary. The SQL and returned evidence remain internal.

The catalog and shop identity/timezone are database mappings. The prompt loads
them at runtime so adding a column or changing business context does not require
embedding shop facts in gateway code. The separate `create_momi_log` contract
remains the only model-visible write path.

## Runtime SQL Exception

ADR `0014` rejects undeclared dynamic relation identities. This decision
permits dynamic SQL only inside the exact declared routine
`momi_analysis.execute_query_v1(text)`, owned by `warehouse-read-api`, for the
exact `momi.shop_analysis_query.v1` contract. The routine is security-invoker,
requires the declared reader role and a read-only transaction, and can reach
only cataloged relations granted to that role. No other dynamic SQL is allowed.

## Consequences

Natural shop analysis no longer requires UUID questions or a new endpoint for
each report. A parser defect cannot grant broader database access because the
database role has no such privilege. Revoking the contract grants or disabling
the gateway tool restores the previous exact-record-only behavior.
