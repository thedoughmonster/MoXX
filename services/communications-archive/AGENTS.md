# Communications Archive Rules

- Own channel-neutral communication capture and durable evaluation only.
- Preserve complete source payloads and source metadata before evaluation.
- Treat archive items as immutable after insert.
- Keep corrections, evaluations, and derived records separate from source items.
- Do not implement source adapters beyond the OpenAI/ChatGPT capture contract.
- Capture functions must not call models, source APIs, or destination APIs.
- Only the evaluator may call `api.openai.com`, and only after claiming exact
  durable work with its capability token.
- Do not call Slack, ClickUp, GitHub, email, SMS, hardware, or destination APIs.
- Use structured capture functions; do not grant agents direct table writes.
- Queue evaluator work durably and idempotently from the capture transaction.
- An empty evaluator dispatch must make no Edge Function or model request.
- Keep routing recommendations destination-neutral; delivery belongs elsewhere.
- Mark operational notes as conversation syntheses; never present them as raw turns.
