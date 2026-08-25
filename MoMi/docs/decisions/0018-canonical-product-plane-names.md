# 0018: Canonical Product Plane Names

- Status: accepted
- Date: 2026-07-25

## Context

Dough Monster needs stable names for its business-authority, shop-sensory, and
human-interaction planes before the latter two gain first-class services or
contracts.

`MoMe`, expanded as “Monster Mesh,” is too easily confused with `MoMi` and
encodes one possible network topology into the sensory capability's identity.
A mesh may be useful, but it is an implementation choice rather than an
architectural boundary.

## Decision

The canonical product-plane names are:

- **MoMi**: the Dough Monster operating system and business-authority plane.
- **MoSi**: **Monster Sensory Infrastructure**, pronounced “mosey.” MoSi is the
  shop's physical sensory and IoT plane.
- **MoXi**: **Monster Experience Interface**, pronounced “moxie.” MoXi is the
  human-interaction platform for staffed POS, kiosk, KDS, Expo, customer status,
  and related operational surfaces.

Technical identifiers use the lowercase forms `momi`, `mosi`, and `moxi`.
`MoMe` and “Monster Mesh” are retired product names. “Mesh” may still describe
an implementation topology.

## Boundaries

MoSi covers sensor acquisition, device identity and enrollment, declared device
capabilities, health and connectivity, shop telemetry, local hardware adapters,
and device-oriented diagnostics. It does not own business decisions, orders,
payments, inventory policy, fulfillment policy, or financial truth. MoMi
services consume MoSi observations only through versioned contracts.

MoXi owns human-facing workflows and presentation, not the domain state those
surfaces display or change. MoSi may expose device-local commissioning,
calibration, and diagnostics. A physical device may run both MoSi and MoXi
components without merging their ownership.

This decision names the planes but does not create services, assign datasets,
or authorize contracts, subscriptions, hardware, network access, or deployment.
Those changes continue to require the service-constitution process.

## Topology

MoSi may use a mesh, local gateways, direct connections, hub-and-spoke routing,
or another approved topology. Its public contracts must describe capabilities
and observations without assuming one topology.

## Transition

No active MoMe service, contract, configuration key, environment variable,
telemetry namespace, persisted identifier, or deployed resource exists in this
repository at acceptance. Active prose adopts MoSi immediately. Historical
evidence retains its original wording when changing it would rewrite the record.

Any later-discovered technical identifier requires an explicit compatibility
disposition before rename; versioned contracts and persisted identities must
not change silently.

## Consequences

- MoMi, MoSi, and MoXi are distinct and mechanically searchable.
- The sensory plane can change network topology without changing identity.
- Device placement does not collapse sensory, interface, or domain authority.
- Future Square/POS and interface work can cite one canonical naming decision.
