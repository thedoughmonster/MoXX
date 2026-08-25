import { buildSafeChildEnvironment } from "./build_safe_child_environment.ts"
import type { BoundedChildRunner, PreflightExecutables } from "./runtime_adapter_types.ts"

export async function collectReleaseTreeSha(
  repositoryRoot: string, releaseSha: string, executables: PreflightExecutables,
  runChild: BoundedChildRunner, sourceEnvironment: NodeJS.ProcessEnv,
): Promise<string> {
  if (!/^[a-f0-9]{40}$/.test(releaseSha)) throw new Error("Released SHA is invalid")
  const result = await runChild({ executable: executables.gitExecutable,
    arguments: ["-C", repositoryRoot, "rev-parse", `${releaseSha}^{tree}`],
    environment: buildSafeChildEnvironment(sourceEnvironment) })
  if (result.outcome.status !== "success" || result.outcome.exitCode !== 0 ||
    result.stderr.byteLength !== 0 || result.stdout.byteLength !== 41) {
    throw new Error("Released tree evidence command failed")
  }
  let output
  try { output = new TextDecoder("utf-8", { fatal: true }).decode(result.stdout) } catch {
    throw new Error("Released tree evidence output is invalid")
  }
  if (!/^[a-f0-9]{40}\n$/.test(output)) {
    throw new Error("Released tree evidence output is invalid")
  }
  return output.slice(0, -1)
}
