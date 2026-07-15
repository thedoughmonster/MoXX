# Event Routing Rules

- Own durable event routing and subscriber delivery lifecycle only.
- Queue messages contain references and canonical identity, never source payloads.
- Keep delivery at-least-once; consumers provide idempotency by `event_id`.
- Do not call Toast, Slack, or any business destination.
- A routing failure must remain durable and use the configured retry policy.
