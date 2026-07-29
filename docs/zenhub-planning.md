# Zenhub Planning

Zenhub is the human-facing planning system for Dough Monster and MoMi. GitHub
remains the backing engineering record for issues, pull requests, commits, and
Actions.

## Synchronization

Create development work as GitHub-backed issues. Zenhub's native repository
webhooks synchronize shared issue fields in both directions. The repository
must not run another label-to-pipeline, roadmap, or issue synchronization
workflow.

Zenhub alone owns pipeline position, priority, estimate, sprint, dates,
hierarchy, and roadmap placement. These fields do not need GitHub mirrors and
their absence or delay must not block repository work.

## Hierarchy

The hierarchy is Initiative → Project → Feature → Issue → Sub-task.

1. **Initiative** — a strategic objective spanning multiple quarters or years.
2. **Project** — a large body of work contributing to an Initiative, usually
   spanning several months.
3. **Feature** — an executable capability or theme grouping related Issues.
4. **Issue** — a Story, Task, or Bug completed in days and directly connected
   to repository work.
5. **Sub-task** — specific work within an Issue, usually completed in hours.

Enable Levels 4 and 5 in **Edit issue types and hierarchy** so strategy and
execution remain visible together. Rename the default Level 3 **Epic** type to
**Feature**. Rename the default Level 4 **Feature** type to **Story**, leaving
**Task** and **Bug** alongside it, so “Feature” has one unambiguous level.

The complete Level 1 set follows ADR `0018`:

- **MoMi** — the Dough Monster operating system and business-authority plane.
- **MoSi** — Monster Sensory Infrastructure (pronounced “mosey”), the shop's
  physical sensory and IoT plane. It covers sensor acquisition, device identity
  and enrollment, declared capabilities, health and connectivity, shop
  telemetry, local hardware adapters, and device-oriented diagnostics. It does
  not own business decisions, orders, payments, inventory or fulfillment
  policy, or financial truth.
- **MoXi** — Monster Experience Interface (pronounced “moxie”), the
  human-interaction platform for staffed POS, kiosk, KDS, Expo, customer status,
  and related operational surfaces. It owns workflows and presentation, not the
  domain state those surfaces display or change.

Every Project has exactly one of these Initiatives as its parent. A physical
device may contain both MoSi and MoXi components without merging their
ownership. Do not add a fourth umbrella Initiative.

## Agent behavior

Agents create one GitHub-backed issue for one repository change and reference
that issue from the pull request. Agents may place or correct the item in
Zenhub, but must not infer missing planning metadata, recreate a repository
mirror, or stop development over visual-only drift.

Strategic organization is edited in Zenhub. Repository review and CI validate
only the GitHub engineering record and owning-issue disposition.
