# Toast Orders Webhook Verification

- Date: 2026-07-12
- Environment: hosted MoMi Supabase project
- Result: passed

## Procedure

1. Registered the source-controlled signed receiver URL in Toast.
2. Submitted an in-store POS order through the normal shop workflow.
3. Observed Toast POST requests returning `200`.
4. Queried the private raw table using administrative access.

## Evidence

- Four signed events were stored during the verification window.
- One was an earlier event replay; three represented the new order lifecycle.
- All stored payloads reported order source `In Store`.
- The three new lifecycle events shared one Toast order GUID.
- Every delivery had its own Toast event GUID.
- All stored requests included the `Toast-Signature` header.
- Payload sizes ranged from 4,115 to 4,220 bytes.
- The first new event showed payment status `OPEN`.
- Later events showed payment status `CLOSED`.
- The full Toast envelope keys were preserved in every record.

## Conclusion

The Orders webhook is suitable as the primary low-latency source for in-store
orders. Multiple events per order are normal and must not create repeated Slack
alerts. Raw event identity and downstream order state remain separate concerns.
