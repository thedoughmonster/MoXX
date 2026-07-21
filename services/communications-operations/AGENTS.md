# Communications Operations Rules

- Append curated logs only through the versioned owner contract.
- `user_flag` requires authenticated, explicit user intent and stable source receipts.
- Never let model or system selection impersonate `user_flag`.
- Replays return the original log and never duplicate it.
- Corrections and supersessions are append-only; never alter archive evidence.
