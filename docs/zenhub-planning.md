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

The hierarchy is Initiative → Project → Epic → Feature/Task/Bug/Spike → Sub-task.

1. **Initiative** — one permanent product plane: MoMi, MoSi, or MoXi. It defines
   an ownership boundary rather than a schedule or temporary goal.
2. **Project** — a durable business or platform capability within one
   Initiative, generally spanning multiple Epics and several months.
3. **Epic** — a substantial, coherent outcome within a Project, usually
   spanning multiple executable issues over weeks or months.
4. **Feature**, **Task**, **Bug**, or **Spike** — the normal delivery level:
   - a Feature adds bounded, testable behavior;
   - a Task performs bounded technical or operational work without presenting
     independent product behavior; and
   - a Bug corrects behavior that violates an accepted contract or experience;
     and
   - a Spike is a bounded investigation intended to resolve uncertainty, gather
     evidence, test feasibility, or recommend a direction. It produces findings
     or a decision, not production behavior.
5. **Sub-task** — an optional, hour-scale execution step within a Feature,
   Task, or Bug. Use Sub-tasks to expose meaningful Feature steps without
   turning each step into another roadmap item.

Use Zenhub's existing issue types without renaming them. Levels 1 through 3
belong in Goals and Planning; Levels 4 and 5 belong in the Work Tracker. Views
may include additional levels when a complete hierarchy is useful.

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

## Pipeline

Use `Idea → Shaping → Designed → Active → Cleanup → Closed`.

- **Idea** holds raw, abstract possibilities that are incomplete and
  uncommitted.
- **Shaping** holds selected planning work while outcome, placement, appetite,
  boundaries, risks, and unknowns are resolved. Spikes commonly run here.
- **Designed** means owner, scope, dependencies, acceptance, and material
  decisions are sufficiently clear for execution.
- **Active** means substantive implementation, investigation, migration, or
  execution is underway.
- **Cleanup** means the core outcome works and only validation, documentation,
  release, reconciliation, small corrections, or issue hygiene remains.
- **Closed** is Zenhub's fixed terminal pipeline and serves as Done: the accepted
  outcome is verified and durable with no required work remaining.

Blocked and external dependency are conditions, not pipelines. Deferred work
returns to Idea or closes as not planned. Review belongs in Cleanup. Functional
gaps return to Active; architectural gaps return to Shaping.

## Agent behavior

Agents create one GitHub-backed issue for one repository change and reference
the lowest issue that accurately owns the pull request. A Feature may own a
small change directly; when a Feature has Sub-tasks, a pull request normally
references the Sub-task it completes while preserving the Feature parent.
Agents may place or correct the item in Zenhub, but must not infer missing
planning metadata, recreate a repository mirror, or stop development over
visual-only drift.

Strategic organization is edited in Zenhub. Repository review and CI validate
only the GitHub engineering record and owning-issue disposition.
