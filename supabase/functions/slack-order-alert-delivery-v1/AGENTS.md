# Slack Order Alert Delivery Rules

- This directory owns only `toast.slack_order_alert.deliver.v1`.
- Accept only a durable delivery work id and its private trigger token.
- Claim work and create its attempt in one database statement.
- Load one prepared message from the versioned alert message view.
- Call only Slack `chat.postMessage` with the prepared payload unchanged.
- Never log or persist `SLACK_BOT_TOKEN`.
- Persist only safe Slack response fields and metadata.
- Never send work that has already succeeded.
- Return a server error when durable state cannot be recorded.
