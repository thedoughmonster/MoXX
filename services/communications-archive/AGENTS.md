# Communications Archive Rules

- Own channel-neutral communication capture and evaluation staging only.
- Preserve complete source payloads and source metadata before evaluation.
- Treat archive items as immutable after insert.
- Keep corrections, evaluations, and derived records separate from source items.
- Do not implement source adapters beyond the OpenAI/ChatGPT capture contract.
- Do not call OpenAI, Slack, ClickUp, email, SMS, hardware, or destination APIs.
- Use structured capture functions; do not grant agents direct table writes.
- Queue evaluator work durably and idempotently from the capture transaction.
- Mark operational notes as conversation syntheses; never present them as raw turns.
