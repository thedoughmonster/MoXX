# Square Payment Acquisition Rules

- Own independent Square payment retrieval and webhook authentication.
- Verify the configured notification URL and exact raw request bytes first.
- Use constant-time Web Crypto verification for the Square signature.
- Reject invalid signatures before parsing or persisting provider content.
- Never log signature headers, keys, payload bodies, or customer data.
- Preserve authenticated evidence and deduplicate provider event identity later.
- Never mutate Square or an ordering service's business state.
- Call only the declared Square Sandbox Payments API host for retrieval.
