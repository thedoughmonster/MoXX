# Slack Order Alert Delivery Rules

- This directory owns only `momi.slack.order_alert.deliver.v1`.
- Stay source-neutral: prepared alerts may originate from any order provider.
- Accept only a durable delivery work id and its private trigger token.
- Claim work and create its attempt in one database statement.
- Load one prepared message from the versioned alert message view.
- Send readable Block Kit order lines; never include a source order GUID.
- Call only Slack `chat.postMessage` with the prepared payload unchanged.
- Never fetch order or other business data.
- Never log or persist `SLACK_BOT_TOKEN`.
- Persist only safe Slack response fields and metadata.
- Never send work that has already succeeded.
- Return a server error when durable state cannot be recorded.
