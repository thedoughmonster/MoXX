# moxi-web Agent Contract

This private repository owns Dough Monster web presentation surfaces. The initial scope is only the public preorder application governed by `momi-backend#167`, #223, #225, and #226.

## Hard rules

- Keep one issue owner and one isolated branch/worktree per change after the initial repository bootstrap.
- Use pnpm, strict TypeScript, React DOM, Vite, and Cloudflare Workers Static Assets.
- Cloudflare owns static delivery and response policy only. Do not add preorder business logic or a second backend to the Worker.
- Browser code may call only accepted versioned Supabase Edge Functions. Do not access tables directly or embed service-role, Square, database, webhook, or other secret credentials.
- Treat all `VITE_*` values as public. Never place a secret in a Vite environment variable.
- Keep public configuration explicit, validate it, and fail safely when launch-required configuration is absent.
- Preserve exact hostname scope. Do not add wildcard routes/domains or any hostname other than an accepted issue target.
- Keep Sentry free of customer payloads, authentication tokens, payment/card data, request bodies, and session replay on customer/payment routes.
- Use semantic, accessible HTML and include loading, pending, failure, and recovery states when the product slice activates them.
- Run focused checks while iterating and one final `pnpm check` before handoff. Inspect rendered output before declaring UI work complete.
- Do not deploy, mutate provider settings, push, create a PR, or handle credentials without exact authority from the owning task.

## UI delivery contract

- Keep repository-specific UI readiness rules here. Generic queue-triage skills
  and orchestration prompts must reference this contract instead of copying or
  extending their own MoXi checklist.
- Do not begin a user-visible change until the owning issue contains direct
  human approval and links or attaches the approved design. One clear approval
  is sufficient; it must cover the applicable responsive, loading, empty,
  failure, recovery, and accessibility behavior.
- Keep UI implementation independently scoped and reviewable from backend or
  business-logic implementation. UI code may consume an accepted versioned
  contract; backend behavior changes require their own issue and PR.
- Route every data-backed feature through the same typed client boundary for
  live and mock execution. Switching modes must require only one documented
  configuration or adapter selection, never component rewrites or per-component
  mock branches.
- Back the mock adapter with believable, deterministic, PII-safe static JSON.
  Validate fixtures against the canonical shared, generated, or Zod contract
  and cover the user-visible success, empty, boundary, authorization, and
  failure scenarios that apply to the feature.
- Mock observable backend responses, not backend business rules. Authorization,
  pricing, workflow, and validation remain backend authority; represent their
  outcomes as named static scenarios.
- Extend the existing fixture and adapter seam before creating parallel mock
  infrastructure. Keep mock-only payloads and controls out of production
  builds.
- When an assigned issue cannot satisfy this contract, record the exact missing
  design, contract, or decomposition decision in the issue and return it to
  planning. Do not create a new label taxonomy, checklist, gate, or policy copy.
