import { canonicalJson } from "./canonical_json.ts"
import { createSetupProgramDependencies } from "./create_setup_program_dependencies.ts"
import { discoverReleasedRepositoryRoot } from "./discover_released_repository_root.ts"
import { runSetupPreflight } from "./run_setup_preflight.ts"

export async function invokeSetupMain(args: string[], moduleUrl: string): Promise<number> {
  let result
  try {
    result = await runSetupPreflight(
      args,
      discoverReleasedRepositoryRoot(moduleUrl),
      createSetupProgramDependencies(),
    )
  } catch {
    result = { exitCode: 20 as const, stderrCode: "RepositoryEvidenceInvalid", envelope: null }
  }
  if (result.envelope) process.stdout.write(`${canonicalJson(result.envelope)}\n`)
  if (result.stderrCode) process.stderr.write(`${result.stderrCode}\n`)
  return result.exitCode
}
