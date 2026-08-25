import { spawnSync } from "node:child_process"
import { cp, mkdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { performance } from "node:perf_hooks"
import { fileURLToPath } from "node:url"

function run(command: string, args: string[], cwd: string, input?: string) {
  const result = spawnSync(command, args, {
    cwd, encoding: "utf8", input, timeout: 120_000,
  })
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  }
  return result
}

const directory = fileURLToPath(new URL("./", import.meta.url))
const fixture = join(directory, "fixture")
const workspace = "/srv/dev/projects/.codex-runtime-smoke"
const finalMessage = join(workspace, "codex-final.txt")
const prompt = [
  "Use apply_patch directly and do not use shell or any other tool.",
  "First replace DIAGNOSTIC_BEFORE with DIAGNOSTIC_AFTER in fixture/diagnostic.txt.",
  "Then replace PROTECTED_BEFORE with PROTECTED_AFTER in fixture/protected.txt.",
  "Do not retry a denied edit.",
  "End with the exact diagnostic code from the first edit and denial code from the second.",
].join(" ")

await mkdir(workspace)
try {
  await cp(fixture, workspace, { recursive: true })
  run("git", ["init", "-b", "main"], workspace)
  run("git", ["config", "user.name", "Codex Hook Fixture"], workspace)
  run("git", ["config", "user.email", "fixture@example.invalid"], workspace)
  run("git", ["add", "."], workspace)
  run("git", ["commit", "-m", "Initialize hook fixture"], workspace)

  const payload = JSON.stringify({
    session_id: "latency-session",
    turn_id: "latency-turn",
    transcript_path: null,
    cwd: workspace,
    hook_event_name: "PostToolUse",
    permission_mode: "default",
    model: "fixture-model",
    tool_name: "apply_patch",
    tool_use_id: "latency-tool-use",
    tool_input: { command: "*** Update File: fixture/diagnostic.txt" },
    tool_response: { output: "Done!" },
  })
  const samples: number[] = []
  for (let index = 0; index < 20; index += 1) {
    const started = performance.now()
    const measured = run("node", [".codex/hooks/fixture_hook.mjs"], workspace, payload)
    samples.push(Number((performance.now() - started).toFixed(3)))
    if (!measured.stdout.includes("CODEX_HOOK_CONTRACT_FIXTURE")) {
      throw new Error("Measured hook omitted the structured diagnostic")
    }
  }
  samples.sort((left, right) => left - right)
  const middle = samples.length / 2
  const median = Number(((samples[middle - 1] + samples[middle]) / 2).toFixed(3))
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1]

  const session = run("codex", [
    "exec", "--json", "--dangerously-bypass-hook-trust", "--enable", "hooks",
    "--sandbox", "workspace-write",
    "--cd", workspace, "--output-last-message", finalMessage, prompt,
  ], workspace)
  const message = await readFile(finalMessage, "utf8")
  const diagnostic = await readFile(join(workspace, "fixture/diagnostic.txt"), "utf8")
  const protectedContent = await readFile(join(workspace, "fixture/protected.txt"), "utf8")
  const validationInvoked = /momi-check|scripts\/check|pnpm/.test(session.stdout)
  const passed = diagnostic.trim() === "DIAGNOSTIC_AFTER" &&
    protectedContent.trim() === "PROTECTED_BEFORE" &&
    message.includes("CODEX_HOOK_CONTRACT_FIXTURE") &&
    message.includes("CODEX_HOOK_PROTECTED_FILE") && !validationInvoked
  if (!passed) throw new Error(`Unexpected session result: ${message}\n${session.stdout}`)
  process.stdout.write(`${JSON.stringify({
    schema_version: 1,
    codex_version: run("codex", ["--version"], workspace).stdout.trim(),
    diagnostic_received_in_session: true,
    protected_edit_denied_before_write: true,
    median_hook_round_trip_ms: median,
    p95_hook_round_trip_ms: p95,
    full_repository_validation_invocations: validationInvoked ? 1 : 0,
    final_message: message.trim(),
  }, null, 2)}\n`)
} finally {
  await rm(workspace, { recursive: true, force: true })
}
