# MoMi Order Read Function Rules

- This directory owns only `momi.orders.get_by_guid.v1`.
- Accept only the strict durable-work capability contract documented here.
- Authorize POST requests with the work id, order GUID, and per-work token.
- Require the registered read contract to be active and correctly mapped.
- Read order data only from `momi_api.toast_orders_by_guid_v1`.
- Never read raw source tables or call Toast, Slack, or another API.
- Return the complete payload from the approved view without transformation.
- Do not make business decisions, mutate work, or perform delivery work.
- Log identifiers and generic errors only, never tokens or order payloads.
