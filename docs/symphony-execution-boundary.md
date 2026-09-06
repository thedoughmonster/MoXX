# Symphony execution boundary

The consolidated scheduler executes `thedoughmonster/MoXX` work against `dev` using `/home/ubuntu/symphony-cutover/WORKFLOW.md`. That workflow owns operational stage routing and model selection. Repository instructions own implementation, validation, and authorized release procedures.

## Admission and ownership

The approved `tracker.provider.project_slugs` are:

- `symphony-execution-d6f95c4b712e` — Symphony Execution
- `backend-product-delivery-e3a66ebf25d7` — Backend Product Delivery
- `backend-stabilization-ab5229c3c922` — Backend Stabilization

Issues stay in their appropriate delivery project. Admission does not require moving every executable leaf into Symphony Execution. Other projects remain outside this instance. Planning coordinators must revalidate materially changed work before releasing it into an active state in one of these projects.

`required_labels: []` means labels are not admission credentials. `ready-package` is retired. Native unfinished blockers prevent Todo dispatch. Native hierarchy and blocker relationships remain authoritative; labels do not replace them. Priority, creation time, and identifier determine scheduling order, not visual board position.

## Stages

| State | Stage | Profile |
| --- | --- | --- |
| Todo, In Progress | implementation | Sol / low |
| Review | review | Sol / medium |
| Rework | rework | Sol / medium |
| Escalated Review | escalated_review | Astra / medium |
| Escalated Rework | escalated_rework | Astra / medium |
| Merging | merging | Sol / low |

Capacity is one shared worker. Each stage boundary starts a fresh conversation while retaining the workspace, branch, PR, and workpad. Todo to In Progress stays within implementation. Review stages are automated independent reviews, not a Human Review queue.

Passing review goes to Merging. Blocking ordinary review goes to Rework, then Escalated Review. A first blocking escalated review goes to Escalated Rework, which adds `final-review` before returning to Escalated Review. A passing final review goes to Merging; a failing final review goes to Parked for help. Preserve the marker unless a human authorizes another automatic correction cycle.

Concept, Refinement, Blocked, Parked, and terminal states are not automatic execution stages. Use Parked for unresolved external blockers in this workflow. Watchdog budget thresholds steer work; they do not impose automatic budget holds or quality approval gates. Explicit operator holds remain effective.

## Workpad and completion

Keep one current `## Codex Workpad` using the OpenAI format: an environment stamp, Plan, Acceptance Criteria, Validation, Notes, and optional Confusions. Edit the same comment in place. Replace obsolete conclusions and summarize resolved findings. Keep the current review verdict and reviewed SHA in Notes; link durable validation evidence and attach the PR natively. Do not accumulate stage transcripts or separate approval packets.

Use focused local checks and the authoritative PR gate. Pending CI is not a code defect; Merging owns the final bounded wait. Required acceptance behavior needs actual evidence, including investigating relevant tests that were skipped. Unrelated path-selected skips and nonblocking suggestions do not delay delivery.

Explicitly read-only planning or evidence issues may complete after their requested artifact is validated, without manufacturing a code-change PR. Code issues follow the configured stages. A merge does not prove deployment: any explicitly required hosted delivery or acceptance must be fulfilled or recorded as remaining work before Done.

## Operational changes

Keep one scheduler and the former implementation/review services disabled. Instruction changes must be coordinated with Watchdog's immutable configuration revision so new attempts report the instruction identity actually in use. Do not hot-reload a changed prompt while leaving its accounting manifest stale. Apply a prepared update at a safe worker boundary, preserve workspaces and accounting history, and verify ready ingest before resuming admission.

The September 2026 consolidation canary is a completed cutover acceptance exercise. It does not create a recurring canary or approval requirement for ordinary product issues. Operational topology or metadata changes require proportionate validation of the behavior being changed.
