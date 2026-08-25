# Trello Task Delivery Rules

- Start only from durable, prepared delivery work.
- Own delivery attempts, retry state, ambiguity, and external response references.
- Call only allowlisted Trello REST routes on `api.trello.com`.
- Send the non-secret client identifier on every mutation.
- Never treat the client identifier as authentication.
- Never blindly retry a create whose outcome is unknown.
- Never read kitchen business tables or make assignment decisions.
- Never log credentials, authorization query parameters, tokens, or secrets.
