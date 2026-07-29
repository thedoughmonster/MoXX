# Trello Data Acquisition Rules

- Own Trello REST source access and acquisition control only.
- Return complete source responses only through the declared acquisition contract.
- Never call archive, task, routing, ingestion, or delivery contracts.
- Call only allowlisted Trello REST routes on `api.trello.com`.
- Never log credentials, authorization query parameters, raw tokens, or secrets.
- Never accept a public provider webhook.
