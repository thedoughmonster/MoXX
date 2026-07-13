# MoMi Toast Order Read Function Rules

- This directory owns only `momi.toast_orders.get_by_id.v1`.
- Accept only the strict durable-work capability contract documented here.
- Authorize with the work id, order id, and per-work token in `momi_orders`.
- Require the work to be running, Toast-owned, and assigned this exact contract.
- Require the registered read contract to be active and correctly mapped.
- Read order data only from `momi_api.toast_orders_by_id_v1`.
- Return its source-neutral presentation beside the unchanged source payload.
- Match the work's source version, location, and order before returning data.
- Never read raw source tables or call Toast, Slack, or another API.
- Return the complete payload unchanged; presentation is a separate view field.
- Do not make business decisions, mutate work, or perform delivery work.
- Log identifiers and generic errors only, never tokens or order payloads.
