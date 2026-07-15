# Toast Data Acquisition Rules

- Start only from a durable acquisition job and verify its capability token.
- Resolve source hosts, operations, methods, paths, and parameters from enabled
  registry rows; never accept transport authority from the HTTP caller.
- Permit only registered GET operations against the configured HTTPS Toast host.
- Fetch at most one logical response page per durable job, apart from one token
  refresh retry after a 401 response.
- A configured exact-resource worker may process multiple durable jobs in one
  bounded Edge lifetime only by atomically completing one job before claiming
  the next. Never pre-claim a batch or carry uncommitted source responses.
- Archive every source request attempt before interpreting its response.
- Never persist authorization headers, access tokens, or configured secrets.
- Preserve complete response text and JSON, immutable resource versions, and
  every observation, including observations of duplicate versions.
- Keep source acquisition separate from projection, decisions, and delivery.
