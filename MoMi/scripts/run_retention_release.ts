import { workspaceRoot } from "./architecture/paths.ts"
import { readOption } from "./read_option.ts"
import { runCommand } from "./release/run_command.ts"
import { approveRetention } from "./release/retention/approval.ts"
import { assertRetentionAuthority } from "./release/retention/assert_authority.ts"
import { executeRetention } from "./release/retention/execute.ts"
import { loadRetentionSources } from "./release/retention/load_sources.ts"
import { verifyRetentionEvidence } from "./release/retention/verify_evidence.ts"

const environment = readOption("env", "")
if (environment !== "dev" && environment !== "prod") throw new Error("Exact retention environment required")
assertRetentionAuthority(environment)
const head = runCommand("git", ["rev-parse", "HEAD"], { capture: true }).stdout.trim()
if (head !== process.env.GITHUB_SHA || !process.versions.node.startsWith("24.")) {
  throw new Error("Retention runtime or checked-out source differs")
}
if (process.env.MOMI_RETIRE_FUNCTIONS || (process.env.MOMI_SERVICES &&
    process.env.MOMI_SERVICES !== "cron-history-governance")) throw new Error("Conflicting deployment scope")
const approval = approveRetention(JSON.parse(process.env.MOMI_RETENTION_APPROVAL_JSON ?? "null"), {
  environment, source_sha: head, approval_sha256: process.env.MOMI_RETENTION_APPROVAL_SHA256 ?? "", now: Date.now(),
})
loadRetentionSources(workspaceRoot, approval)
const developmentBundle = await verifyRetentionEvidence(approval)
if (!process.argv.includes("--verify-only")) await executeRetention(approval, developmentBundle)
