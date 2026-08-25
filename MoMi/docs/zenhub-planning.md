# Zenhub Planning

Zenhub is the human-facing planning system. GitHub remains the engineering
record for issue identity, body, state, comments, pull requests, and delivery
evidence. ADR `0021` owns this progressive-elaboration contract.

## Synchronization and authority

Create development work as GitHub-backed issues. Zenhub's native repository
webhooks synchronize shared issue fields; the repository must not run another
label-to-pipeline, roadmap, or issue synchronization workflow.

Zenhub owns hierarchy, pipeline, relative order, priority, estimate, sprint,
dates, and roadmap placement. GitHub owns titles, bodies, labels, state reasons,
and closure evidence. Correct material planning drift before implementation.

## Hierarchy

The hierarchy is Initiative → Project → Epic → Feature/Task/Bug → Sub-task.

1. **Initiative** — a durable strategic business outcome.
2. **Project** — a durable capability investment within one Initiative.
3. **Epic** — a coherent outcome that coordinates executable delivery.
4. **Feature**, **Task**, or **Bug** — one independently closable outcome.
5. **Sub-task** — the smallest useful execution slice inside Level 4.

The complete Initiative set is:

- **Customer Ordering & Experience**
- **Payments & Commerce**
- **Kitchen Production & Interfaces**
- **Operations Systems & Automation**
- **Data, Analysis & Reporting**
- **Platform Reliability & Governance**
- **Brand, Marketing & Customer Growth**

ADR `0018` still defines the MoMi, MoSi, and MoXi product-plane names. They,
together with `shared`, classify implementation surfaces; they are not
Initiative roots. Surface labels normally belong only on Level 4. The preorder
Sub-tasks #271 through #278 are the explicit Level-5 exception.

## Progressive elaboration

Opened and Discovering parents record possible scope under a `Future
decomposition candidates` heading. Candidate bullets are not issues.

- Opened contains Levels 1 through 3 only.
- Create Level 4 directly in Designing only while its Level-3 parent is in
  Designing.
- Create Level 5 directly in Designing only while its Level-4 parent is in
  Designing.
- New Level-4 and Level-5 issues never begin in Opened.
- A generated child may regress to Discovering only when its body records the
  exact unresolved evidence, decision, or feasibility question.
- A child never returns to Opened.
- If a parent regresses, existing children remain but no new child is created
  until the parent returns to Designing.
- Before Building, Level 4 is independently closable and Level 5 is an atomic
  execution slice.
- Premature children are consolidated into the parent, closed as not planned,
  and later regenerated as fresh issues rather than reopened.

## Pipelines and completion requirements

**Opened:** Valid Level-1 through Level-3 work not yet in active discovery. To
leave, the outcome, parent, investment evidence, and initial boundaries are
clear. Future decomposition remains in the parent body.

**Discovering:** Evidence, constraints, ownership, feasibility, and material
unknowns are being established. To leave, authority boundaries, dependencies,
risks, and decision owners are explicit enough to design. Lower-level issues
appear only as documented regressions; new ones are prohibited.

**Designing:** Interfaces, dependencies, acceptance criteria, exclusions,
rollout, rollback, and the executable plan are established. Generate Level 4
and Level 5 only under a parent currently in Designing. To leave, material
decisions are resolved and `plan:accepted` is present when the body is the
accepted executable plan.

**Building:** Implementation or active delivery coordination is underway. To
leave, the independently closable outcome exists at an exact candidate,
required checks pass, and only validation, acceptance, release, cleanup, or
closure remains.

**Finalizing:** Implementation exists and awaits final evidence or closure. To
close, acceptance criteria and authoritative receipts prove the outcome; use
completed, duplicate with a named survivor, or not planned as the exact reason.

Zenhub limits pipeline descriptions to 144 characters. The workspace stores a
complete compact exit gate for each pipeline; this document owns the full text.

## Agent behavior

Create one GitHub-backed issue for one repository change and reference the
lowest issue that accurately owns the pull request. Do not create speculative
Level-4 or Level-5 inventories. Moving work backward is required when its
evidence does not support the current pipeline. Strategic organization remains
in Zenhub; repository review validates the GitHub record and disposition.
