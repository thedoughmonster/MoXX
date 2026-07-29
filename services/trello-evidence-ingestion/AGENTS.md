# Trello Evidence Ingestion Rules

- Own Trello webhook authentication and evidence admission control only.
- Preserve the exact raw webhook body until signature verification completes.
- Treat the callback URL as signature-bound non-secret configuration.
- Use the acquisition contract for Trello REST reads; never call Trello directly.
- Submit complete JSON evidence only through the archive capture contract.
- Never read archive evidence or call task, routing, or delivery contracts.
- Accept HEAD callback probes without creating evidence.
- Use Trello action IDs as inbound idempotency keys.
- Never log credentials, raw webhook bodies, authorization data, or secrets.
