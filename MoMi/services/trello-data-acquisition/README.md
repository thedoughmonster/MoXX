# Trello Data Acquisition

## ELI5

This service performs controlled REST reads of the kitchen board and returns
complete source responses to the evidence-ingestion coordinator. It does not
archive or interpret them.

## Boundary

The service owns canonical Trello resource discovery, rate-limit handling, and
acquisition control. It calls Trello only and consumes no MoMi-owned contract.
The runtime slices durably acquire either one complete board snapshot or one
complete token webhook inventory for a capability-authorized job. They remain
separate from interpretation and delivery.

## Security

Credential values are supplied only through the deployment secret UI. The
manifest contains opaque names, never values.
