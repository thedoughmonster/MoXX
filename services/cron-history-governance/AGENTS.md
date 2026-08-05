# Cron History Governance Rules

- Own only sanitized governance state; never claim ownership of `cron` objects.
- Never persist command text, raw return messages, or Prometheus exposition
  text.
- Keep every scan and mutation bounded by the ordered `runid` primary key.
- Fail closed when health evidence, coverage, or commit state is ambiguous.
- Keep the recurring governor disarmed until its environment canary is accepted.
- Never perform physical-reclamation operations from this service.
