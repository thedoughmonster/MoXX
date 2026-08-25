# Toast Webhook Ingestion Rules

- Authenticate every event with the secret for its exact Toast subscription.
- Verify `Toast-Signature` against the untouched request body and payload timestamp.
- Accept only category and type pairs declared by the subscription contract.
- Preserve the exact signed body and complete payload in `toast_raw.webhook_events`.
- Never persist request headers; authentication material stays outside the archive.
- Hash the untouched request body and use the event GUID for idempotency.
- Derive restaurant identity only from source fields; leave it null when absent.
- Never call Toast, another Edge Function, or any other outbound API.
- Never normalize payloads or perform business decisions in this service.
- Log event identifiers and error names only, never payloads or secrets.
