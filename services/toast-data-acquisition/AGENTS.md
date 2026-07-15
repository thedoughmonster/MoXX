# Toast Data Acquisition Rules

- Start only from a durable acquisition job and verify its capability token.
- Resolve source hosts, operations, methods, paths, and parameters from enabled
  registry rows; never accept transport authority from the HTTP caller.
- Permit only registered GET operations against the configured HTTPS Toast host.
- Fetch at most one logical response page per invocation, apart from one token
  refresh retry after a 401 response.
- Archive every source request attempt before interpreting its response.
- Never persist authorization headers, access tokens, or configured secrets.
- Preserve complete response text and JSON, immutable resource versions, and
  every observation, including observations of duplicate versions.
- Keep source acquisition separate from projection, decisions, and delivery.
