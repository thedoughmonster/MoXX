# Trello Data Acquisition

## ELI5

This service performs controlled REST reads of the kitchen board and returns
complete source responses to the evidence-ingestion coordinator. It does not
archive or interpret them.

## Boundary

The service owns canonical Trello resource discovery, rate-limit handling, and
acquisition control. It calls Trello only and consumes no MoMi-owned contract.
The first runtime slice durably acquires one complete board snapshot for a
capability-authorized job. It remains undeployed until release is authorized.

## Security

Credential values are supplied only through the deployment secret UI. The
manifest contains opaque names, never values.
