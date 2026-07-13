# Slack Order Delivery Rules

- Stay source-neutral and start only from durable delivery work.
- Claim work and create its attempt atomically.
- Load one prepared message from the approved versioned alert view.
- Send readable Block Kit lines and omit source GUIDs from the payload.
- Call only Slack `chat.postMessage` with the prepared payload unchanged.
- Never fetch order or other business data.
- Never log or persist `SLACK_BOT_TOKEN`.
- Never resend work that already succeeded.
- Return failure when durable outcome recording fails.
