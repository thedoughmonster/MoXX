# Toast Webhook Ingestion

## ELI5

Toast sends several kinds of signed change notices. This service checks the
right signature, confirms that the notice matches its subscription, and saves
the complete notice once so other backend capabilities can process it later.

## Scope

`toast-webhooks-ingest-v1` is the shared route for menus, packaging,
restaurant availability, and ordering schedule subscriptions. Existing order
and stock routes retain their public contracts while also writing the central
envelope.

The service authenticates inbound events and writes raw source records only.
It does not fetch Toast resources, interpret changes, or invoke downstream
services.

## Data Authority

- Writes only the Toast raw event relation; database constraints bind each
  envelope to the registered subscription/category/type tuple.
- Stores the exact signed body, complete JSON payload, exact-body SHA-256 hash,
  event correlation ID, restaurant GUID when supplied, and handler version.
- Stores no request headers, so signatures and gateway credentials cannot enter
  the archive.
- Treats the Toast event GUID as the idempotency key.
- Has no outbound network authority.

## Secrets

Each subscription uses its own secret: orders, stock, menus, packaging,
restaurant availability, and ordering schedule. Secret names are declared in
`service.json`; values remain in Supabase runtime configuration.

## Verification

Run `npm run check -- --service toast-webhook-ingestion` from the repository
root. Focused tests cover signatures, accepted contracts, rejected categories
and types, exact hashing, duplicate delivery, and replay behavior.
