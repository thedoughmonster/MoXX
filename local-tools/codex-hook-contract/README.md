# Codex Edit-Event Hook Contract Proof

## ELI5

This disposable mini-repository proves what Codex can do immediately before and
after an `apply_patch` edit. It does not install a production hook or replace any
MoMi validation command.

## Boundary

This is manual local tooling. It creates a temporary Git repository, copies the
fixture into it, starts one non-interactive Codex session, records evidence, and
deletes the temporary repository. It is never deployed, hosted, scheduled, or
imported by runtime code. MOX-164 and MOX-165 own later production integration.

## Supported contract

The contract is pinned to Codex CLI `0.147.0` and the official
[Hooks documentation](https://learn.chatgpt.com/docs/hooks) observed on
2026-08-16.

| Concern | Proven contract |
| --- | --- |
| Configuration | Trusted repo-local `.codex/hooks.json`; hook commands resolve from the Git root. |
| Edit match | `apply_patch` is canonical; `Edit` and `Write` are matcher aliases. |
| Pre-write | Synchronous `PreToolUse` runs before `apply_patch`; `permissionDecision: "deny"` prevents the tool call. |
| Post-write | Synchronous `PostToolUse` runs after tool output and cannot undo side effects. |
| Same session | `hookSpecificOutput.additionalContext` is developer context for the next model request in the active turn. |
| Input | JSON on stdin with common fields plus `turn_id`, `tool_name`, `tool_use_id`, and `tool_input`; post-use also includes `tool_response`. |
| Output | JSON on stdout; plain text is ignored for these tool events. |
| Multiple hooks | Matching commands launch concurrently; no cross-hook ordering may be assumed. |
| Trust | Changed non-managed hook definitions are skipped until reviewed; the proof uses the documented one-off trust bypass. |
| Coverage | Shell, unified exec, `apply_patch`, MCP, and local function tools participate; hosted tools and opted-out specialized paths do not. |

For one tool invocation the usable ordering is `PreToolUse → tool →
PostToolUse`. A pre-use denial ends the sequence before the tool, while a
post-use block can replace feedback but cannot restore the edited file.

## Diagnostic envelope

The minimum MoMi diagnostic is:

```json
{
  "code": "STABLE_CODE",
  "path": "repo/relative/path",
  "severity": "error",
  "evidence": { "event": "PostToolUse", "tool_name": "apply_patch" },
  "repair_class": "SEMANTIC_REPAIR"
}
```

The fixture returns that envelope inside `additionalContext` after editing
`fixture/diagnostic.txt`. For `fixture/protected.txt`, it returns a pre-use deny
whose reason contains the same envelope shape with `NEVER_REPAIR`.

## Failure behavior

- Exit `0` with no output means success and Codex continues.
- Exit `2` with stderr is a supported pre-use denial or post-use feedback path.
- Invalid JSON, timeout, a nonzero exit other than the supported decision, or an
  unsupported output field is reported as a hook failure. It must not be treated
  as an authorization boundary; specialized tool paths can bypass hooks.
- Protected artifacts therefore need both the pre-use guard and unchanged
  authoritative repository validation. A post-use hook may escalate and require
  restoration, but it cannot claim to have prevented or undone a write.
- Background hooks cannot block or rewrite operations, so edit diagnostics and
  protected-file guards must remain synchronous.

## Reproduce

Focused offline contract tests:

```text
node --test local-tools/codex-hook-contract/hook_contract.test.ts
```

Live same-session proof (uses the configured Codex account and no repository
validation command):

```text
node local-tools/codex-hook-contract/run_codex_proof.ts
```

The default proof workspace is `/srv/dev/projects/.codex-runtime-smoke`. That
exact project must already be trusted so Codex can load its repo-local config;
the command-line bypass covers hook-definition review, not project trust.
If a process interruption leaves that exact directory behind, the next run
fails without deleting it; inspect and remove only the disposable fixture.

The live proof succeeds only when the diagnostic edit changes, the protected
edit remains unchanged, both structured codes reach the same session's final
message, and twenty direct hook process round trips produce the diagnostic. Its
JSON report includes median and p95 latency plus a zero count for full repository
validation invocations.

## Observed evidence

On 2026-08-16, Codex CLI `0.147.0` returned both
`CODEX_HOOK_CONTRACT_FIXTURE` and `CODEX_HOOK_PROTECTED_FILE` in the same final
message. The diagnostic fixture contained `DIAGNOSTIC_AFTER`; the protected
fixture still contained `PROTECTED_BEFORE`. Twenty direct, single-file hook
process round trips measured 45.176 ms median and 48.096 ms p95. The proof report
recorded `full_repository_validation_invocations: 0`.
