# Development Execution Handoffs

Keep routine work with one owner. Use a fresh transcript-free executor only
when the work is complex, stale-context, or explicitly delegated.

## Deterministic packet

Create the packet from the exact repository state:

```text
pnpm momi-context pack --issue <number> --title "<title>" \
  --base <sha> --head <sha> --output .momi/context.json
```

The packet contains the owning issue, exact commit/tree identities, changed
paths, applicable rule and contract hashes, impact-selected checks, decisions,
material stops, and diff/impact hashes. It redacts credential-shaped data.
Running it against the same inputs and repository state is byte-identical.

A fresh executor receives only this packet and the named source files. It has no
inherited transcript and does not spawn children. Handoff/fork features that
preserve history are not fresh execution.

## Model routing

- Use Spark, when supported, for bounded read-only discovery, issue triage,
  changed-path inventory, and deterministic receipts.
- Use the normal primary model for implementation, debugging, review, release,
  and acceptance.
- Use the highest-depth model only for material architecture, security, privacy,
  exposure, destructive migration, or genuinely difficult failure decisions.

Missing evidence or behavioral ambiguity falls back once to the normal primary
model. Do not route one task through several models for agreement. GitHub API
model calls remain separately billed.

Optional silent hooks are not part of the normal loop until measured evidence
shows net context reduction without hiding material transitions or secrets.

## Return

Return one compact receipt with base/head/tree/diff identity, checks, durations,
bounded failure excerpts, acceptance, issue disposition, and real follow-ups.
Continue through benign SHA, identifier, metadata, timing, or bounded tooling
drift. Stop only for the materiality list embedded in the packet.
