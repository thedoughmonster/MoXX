# 0013: MoMi Service Constitution

- Status: accepted
- Date: 2026-07-17

## Context

MoMi is adding many future sources and capabilities. Service-by-service
boundary decisions are not enough; every new feature needs the same ownership
law before implementation starts.

## Decision

Every dataset has exactly one owning service. Other services may read or write
that dataset only through the owner service's versioned public contracts.

The general data flow is:

```text
procurement -> optional transform -> raw evidence archive -> event router
  -> dataset owners -> reads and destinations
```

Service types are:

- `procurement_adapter`: owns external source access only. It may call the
  external source but may not call MoMi-owned services or own domain datasets.
- `transform`: converts non-archive-ready payloads such as CSV, email, PDFs,
  or images into archive-ready evidence. It does not define business meaning.
- `raw_evidence_archive`: owns immutable raw evidence storage and metadata.
- `event_router`: owns reference-only fanout, retries, and dead lettering.
- `dataset_owner`: owns one coherent dataset/capability, its private storage,
  public read/write contracts, events, validation, repair, and permissions.
- `read_facade`: owns common read authorization or routing only; it does not
  own dataset meaning.
- `destination_adapter`: calls an external destination with prepared data. It
  does not fetch source data or business truth.

A dataset owner may own multiple physical relations only when those relations
form one coherent dataset contract. If a service owns multiple unrelated
datasets, it must split or create a named parent capability service.

## Enforcement

Architecture enforcement must ratchet from soft to hard:

- New services, datasets, relations, permissions, contracts, or cross-service
  dependencies must be declared in manifests before implementation.
- Existing pre-constitution drift may be allowlisted in a dated baseline.
- CI must fail on new drift even while legacy drift remains.
- Final enforcement requires service-specific database roles and grants so
  private datasets cannot be bypassed at runtime.

## Consequences

MoMi can keep developing while known debt is burned down. Future services use
one classification system, and dataset ownership becomes enforceable by
manifests, CI, database grants, and release checks.
