# Trello Evidence Ingestion

## ELI5

This service is the secure handoff desk between Trello and MoMi's archive. It
checks webhook authenticity, asks the source reader for reconciliation data,
and submits complete evidence without deciding what a kitchen task means.

## Boundary

The transform owns webhook authentication, source-response admission,
idempotency control, and archive submission. The first runtime slice accepts
Trello's `HEAD` probe and authenticated `POST` delivery, then writes evidence
only through the archive's versioned capture contract. It calls Trello only
through the source adapter's versioned acquisition contract.

Reconciliation and acquisition runtime land later. The webhook function remains
undeployed until credentials and deployment are separately authorized.

## Security

`TRELLO_WEBHOOK_SECRET` is supplied only through the deployment secret UI.
`TRELLO_WEBHOOK_CALLBACK_URL` is non-secret but signature-bound configuration.
The function signs no outbound requests and persists no request headers except
the documented non-secret `X-Trello-Client-Identifier` correlation marker.
