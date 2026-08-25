# Model Execution Gateway Rules

- Authenticate the exact purpose-bound caller before parsing provider content.
- Resolve provider endpoint, model, reasoning, and ceilings only from owned mappings.
- Permit only the OpenAI Responses API create and retrieval operations.
- Never repeat an ambiguous paid request or accept caller-supplied credentials.
- Store metadata and identities only; callers retain full request and response evidence.
- Never log or persist credentials, authorization headers, webhook secrets, or bodies.
- A duplicate idempotency key may never create a second paid attempt.
