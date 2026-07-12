# Edge Function Rules

- One directory equals one independently callable function.
- Keep every handwritten file at or below 120 physical lines.
- Declare at most one function per TypeScript file.
- Keep `index.ts` limited to imports and runtime registration.
- Pin every external dependency in the function's `deno.json`.
- Public webhooks must implement source-specific authentication in code.
- Read secrets from environment variables; never accept them in request URLs.
- Store raw data before invoking any downstream behavior.
- Return success for an idempotent replay.
- Return a server error when durable storage fails.
- Log identifiers and errors only; never log full source payloads or secrets.
