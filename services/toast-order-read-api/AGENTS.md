# Toast Order Read API Rules

- Accept only the strict durable-work capability contract documented here.
- Require running work assigned to this exact Toast reader contract.
- Read only approved `momi_api` views and never raw source tables directly.
- Return the complete source payload unchanged beside common presentation data.
- Match work, source version, location, and order identity before returning.
- Never call Toast, Slack, or another API.
- Do not make alert decisions, mutate work, or perform delivery.
- Never log work tokens or order payloads.
