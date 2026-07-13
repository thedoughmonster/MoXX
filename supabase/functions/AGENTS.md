# Edge Function Rules

- One directory equals one independently callable function.
- Keep every handwritten file at or below 120 physical lines.
- Declare at most one function per TypeScript file.
- Keep `index.ts` limited to imports and runtime registration.
- Give every direct function directory a `README.md` describing its purpose,
  contract, durable flow, configuration, and authority boundary.
- Give every direct function directory a local `AGENTS.md` containing only its
  function-specific invariants; inherit shared rules from this file.
- Give every direct function directory a complete `function.json` conforming to
  `docs/contracts/edge-function-manifest-v1.md`.
- Treat `purpose`, `capability`, `boundary`, and `owner_service` as the function's
  logical identity; runtime, route, and directory are deployment metadata.
- Keep each manifest's route aligned with its directory and its contract paths
  aligned with files owned by that function.
- Regenerate `docs/service-catalog.md` after manifest changes; never edit the
  generated catalog by hand.
- Pin every external dependency in the function's `deno.json`.
- Public webhooks must implement source-specific authentication in code.
- Read secrets from environment variables; never accept them in request URLs.
- Ingest functions persist source data and durable work records only.
- Ingest functions must not call downstream APIs or other Edge Functions.
- Hydration functions may call only their configured source API.
- Hydration must start from durable scheduled work and persist complete responses.
- Hydration retries must be idempotent and must not run inside a read request.
- Persist a full resource version before creating downstream invocation work.
- MoMi API invokers must start from durable work and pass source identity only.
- Decision functions must not call source APIs or read raw tables in service code.
- Internal modules coordinate through warehouse records, not HTTP calls.
- Under ADR `0004`, the hydrated alert worker may call only the exact versioned
  MoMi Order API route named by its claimed durable work.
- Delivery functions may call only configured destinations for durable outcomes.
- Return success for an idempotent replay.
- Return a server error when durable storage fails.
- Log identifiers and errors only; never log full source payloads or secrets.
