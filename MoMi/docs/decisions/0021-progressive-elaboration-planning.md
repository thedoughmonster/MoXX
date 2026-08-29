# 0021: Progressive-Elaboration Planning

- Status: superseded
- Date: 2026-07-30
- Owning issue: #295

## Supersession

This decision records the former GitHub/Zenhub planning model. On 2026-08-28,
MOX-429 superseded that active authority: Linear now owns planning hierarchy and
work state, while GitHub retains code, CI, review, merge, and release evidence.
The historical decision text below is preserved rather than silently rewritten.

## Context

The workspace accumulated speculative Level-4 and Level-5 issues before their
parents had enough evidence to design them. That made Opened a task inventory,
obscured strategic order, and allowed issue existence to imply maturity that
the parent had not earned.

The former planning contract also treated MoMi, MoSi, and MoXi as the complete
Initiative set. ADR 0018 defines those product-plane names and boundaries, but
they are implementation surfaces rather than business-outcome roadmap roots.

## Decision

Use seven capability Initiatives: Customer Ordering & Experience; Payments &
Commerce; Kitchen Production & Interfaces; Operations Systems & Automation;
Data, Analysis & Reporting; Platform Reliability & Governance; and Brand,
Marketing & Customer Growth.

Use the pipelines Opened, Discovering, Designing, Building, and Finalizing.
Each pipeline had an explicit completion gate in the now-retired Zenhub
planning document and a compact equivalent in Zenhub's 144-character
description field.

Adopt progressive elaboration:

- Opened contains Levels 1 through 3 only.
- Potential child scope stays in the parent body while the parent is Opened or
  Discovering.
- Level 4 is created directly in Designing only while its Level-3 parent is in
  Designing.
- Level 5 is created directly in Designing only while its Level-4 parent is in
  Designing.
- Generated children may regress to Discovering with an exact unresolved
  question, but never enter or return to Opened.
- Level 4 must be independently closable before Building; Level 5 must be an
  atomic execution slice.
- Premature children are consolidated into their parent, closed as not planned,
  and regenerated as fresh issues only when the parent reaches Designing.

MoMi, MoSi, MoXi, and shared remain implementation-surface classifications.
They do not replace or add to the seven Initiative roots.

## Consequences

- Strategic ordering is visible before speculative implementation inventory.
- Issue creation records earned decomposition rather than possible future work.
- Moving work backward is normal when evidence does not support its maturity.
- Closed premature issues preserve history while parents retain candidate scope.
- At acceptance time, GitHub was the engineering record and Zenhub was the
  planning authority; the supersession above replaces that authority.
- Existing product/runtime behavior, services, deployments, and provider state
  are unchanged by this decision.
