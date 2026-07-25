# Gateway Function Rules

- Authenticate only the purpose-bound OpenWebUI gateway credential.
- Treat body identity as authenticated only after that credential succeeds.
- Archive admission before provider egress and terminal evidence before success.
- Never retry a model call or log request, response, tool data, or credentials.
- Never hold an OpenAI credential or call a provider host directly.
