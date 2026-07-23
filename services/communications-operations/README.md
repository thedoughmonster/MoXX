# Communications Operations

## ELI5

This service creates one durable shop-log entry when a user explicitly says or
clicks “log this.” Repeating the same action returns the same entry.

## Boundary

The service owns append-only selections, logs, corrections, and audit evidence.
It stores source receipt links, not copied transcript ownership, and never
rewrites the communications archive. `model_suggested` and `system_generated`
remain distinct from `user_flag`.

## Tests

Run `pnpm check -- --service communications-operations`.
