# ADR 0004: Supabase-Native Work Invocation

## Status

Accepted on 2026-07-12 with explicit user approval.

## Context

MoMi no longer needs a continuously running external worker host. Each stage is
already represented by durable warehouse work, while Supabase Edge Functions own
the source, API, decision, and destination boundaries.

## Decision

Use `pg_net` only in dedicated trigger adapters that wake exact allowlisted Edge
Function routes after durable work commits. Requests contain the work id and its
private per-work capability token. The receiving function validates and claims
that work before doing anything else.

A source-neutral decision worker may call the exact versioned, source-specific
owned order reader when its durable work names that API contract and the active
registry resolves exactly one route. It sends only work id, order id, and the
work token. This is the only approved Edge Function-to-Edge Function call.

Project URLs and publishable gateway keys are stored in Supabase Vault. Edge
workers may use Supabase's built-in public gateway key for the same purpose.
Business credentials remain Edge Function secrets. Trigger adapters never send
payloads, business values, reusable internal credentials, or destination data.

## Constraints

- The database never calls Toast, Slack, or any source or destination API.
- Arbitrary URLs, methods, function names, and request bodies are prohibited.
- A durable work row and unique capability token exist before every wake-up.
- Duplicate and missed wake-ups are recovered from durable work state.
- Workers record attempts and outcomes independently of `pg_net` response logs.
- Only migrations explicitly named as trigger adapters may reference `pg_net`.

## Consequences

MoMi can run entirely on Supabase while preserving modular boundaries and
idempotent recovery. The architecture accepts a narrow internal HTTP hop to the
owned reader instead of allowing decision code to query warehouse tables.
