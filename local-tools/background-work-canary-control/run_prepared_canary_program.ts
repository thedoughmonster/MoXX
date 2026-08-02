import { buildDeadmanTerminalContext } from "./build_deadman_terminal_context.ts"
import { buildProgramFailure } from "./build_program_failure.ts"
import { buildSamplingTerminalContext } from "./build_sampling_terminal_context.ts"
import { finalizeCanaryProgram } from "./finalize_canary_program.ts"
import type { DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import type { CanaryProgramDependencies, CanaryProgramResult,
  CanaryTerminalContext } from "./program_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export async function runPreparedCanaryProgram(
  runtime: ReleasedRuntime,
  repositoryRoot: string,
  dependencies: CanaryProgramDependencies,
): Promise<CanaryProgramResult> {
  let receiptRoot: string
  try { receiptRoot = await dependencies.prepareReceiptRoot() } catch {
    try { await runtime.lock.release() } catch { /* fixed pre-guard failure */ }
    return buildProgramFailure("pre_guard")
  }
  if (runtime.lock.status() !== "held" || runtime.lock.lossSignal.aborted) {
    try { await runtime.lock.release() } catch { /* holder is already lost */ }
    return buildProgramFailure("pre_guard")
  }
  let signals
  try { signals = dependencies.installSignalHandlers() } catch {
    try { await runtime.lock.release() } catch { /* fixed pre-guard failure */ }
    return buildProgramFailure("pre_guard")
  }
  let terminal: CanaryTerminalContext | null = null
  try {
    const lifecycleSignal = AbortSignal.any([signals.signal, runtime.lock.lossSignal])
    const sampling = await dependencies.runSampling(
      runtime, repositoryRoot, receiptRoot, lifecycleSignal,
    )
    const terminalAtUtc = new Date(dependencies.nowUtcMs()).toISOString()
    if (sampling.status === "pre_guard_failure" ||
      sampling.status === "sampling_failed_rollback_completed") {
      terminal = buildSamplingTerminalContext(runtime, sampling, terminalAtUtc)
      if (!terminal) {
        if (!sampling.lockReleased) {
          try { await runtime.lock.release() } catch { /* process exit also releases */ }
        }
        return buildProgramFailure("pre_guard")
      }
    } else {
      const handoff = sampling as DeadmanPhaseHandoff
      const deadman = await dependencies.runDeadman(handoff, lifecycleSignal)
      terminal = buildDeadmanTerminalContext(runtime, handoff, deadman,
        new Date(dependencies.nowUtcMs()).toISOString())
    }
    if ((runtime.lock.status() === "lost" || runtime.lock.lossSignal.aborted) &&
      terminal.artifactInput.deadmanEvidence !== null &&
      terminal.artifactInput.status === "inactive_dry_run_verified") {
      terminal.artifactInput.status = "failure_recovered_by_deadman"
    }
    return await finalizeCanaryProgram(terminal, dependencies)
  } catch {
    runtime.lock.retainUntilExit?.()
    return buildProgramFailure("manual")
  } finally { signals.remove() }
}
