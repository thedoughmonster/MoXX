# Model execution gateway

## ELI5

This service is MoMi's single guarded door to paid AI models. Other services
name the job they need done; this service chooses the approved model and
limits, makes the request, and records safe operational metadata.

Domain owners send a
bounded purpose/profile request; the gateway chooses the configured provider
model, enforces limits, performs one HTTP request, and returns the provider
result with a content-free execution receipt.

It owns the `momi_model_execution` operational ledger. The ledger records call,
caller, purpose, provider identities, timing, status, token usage, calculated
cost, and sanitized errors. Prompts and responses remain with the caller and
are never stored here.

Current callers are communications, communications evaluation, and GitHub issue
triage. They authenticate with separate purpose-bound secrets. The gateway
rejects arbitrary endpoints, models, methods, retries, and payload controls
owned by its profile mapping.

The initial function supports synchronous and background Responses API creates
plus retrieval. The separately tracked webhook function adds durable terminal
notifications without changing this ownership boundary.

Run `pnpm momi-check changed` while iterating. Release only through the normal
GitHub validation and environment-bound deployment workflows.
