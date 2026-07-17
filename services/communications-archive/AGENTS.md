# Communications Archive Rules

- Own immutable generic JSON evidence and source provenance only.
- Preserve complete source payloads and source metadata before evaluation.
- Treat archive items as immutable after insert.
- Keep evaluation and derived records under `communications-evaluation`.
- Do not implement source adapters beyond the OpenAI/ChatGPT capture contract.
- Capture functions must not call models, source APIs, or destination APIs.
- Never call a model, source API, or destination API.
- Do not call Slack, ClickUp, GitHub, email, SMS, hardware, or destination APIs.
- Use structured capture functions; do not grant agents direct table writes.
- Hand evaluation work to the evaluation owner's versioned contract.
- Mark operational notes as conversation syntheses; never present them as raw turns.
