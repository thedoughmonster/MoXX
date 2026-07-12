# Edge Function Rules

- One directory equals one independently callable function.
- Keep every handwritten file at or below 120 physical lines.
- Declare at most one function per TypeScript file.
- Keep `index.ts` limited to imports and runtime registration.
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
