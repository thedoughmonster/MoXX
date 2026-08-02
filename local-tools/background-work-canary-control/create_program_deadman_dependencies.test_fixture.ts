import { appendReceipt } from "./append_receipt.ts"
import { buildDeadmanReconciliationOutput } from "./build_deadman_reconciliation_output.test_fixture.ts"
import { buildTestProviderOutput } from "./build_test_provider_output.test_fixture.ts"
import type { DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { VALID_CLEANUP_RESULT } from "./recovery_control.test_fixture.ts"
import { CLEANUP_MARKER } from "./recovery_control_constants.ts"
import type { InternalProviderSqlKind } from "./runtime_adapter_types.ts"
import type { SamplingHarnessTelemetry } from "./sampling_test_types.test_fixture.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"

export function createProgramDeadmanDependencies(
  handoff: DeadmanPhaseHandoff,
  source: SamplingHarnessTelemetry,
  options: { guardPresent?: boolean; reconciliationFailure?: boolean } = {},
): { dependencies: DeadmanPhaseDependencies; providerKinds: InternalProviderSqlKind[] } {
  let monotonicMs = 1_000
  const providerKinds: InternalProviderSqlKind[] = []
  const dependencies: DeadmanPhaseDependencies = {
    clock: { nowUtcMs: () => source.nowUtcMs },
    monotonicNowMs: () => monotonicMs,
    timer: {
      setAt: (utcMs, task) => {
        const delay = Math.max(0, utcMs - source.nowUtcMs)
        monotonicMs += delay
        source.nowUtcMs = utcMs
        queueMicrotask(task)
        return () => undefined
      },
    },
    appendReceipt,
    verifyReceipt: verifyReceiptFile,
    query: async (request) => {
      providerKinds.push(request.sql.kind)
      if (request.sql.kind === "deadman_reconciliation" &&
        options.reconciliationFailure) {
        return { status: "failure", reason: "timed_out" }
      }
      try {
        let output
        if (request.sql.kind === "deadman_reconciliation") {
          output = buildDeadmanReconciliationOutput(
            handoff, source.nowUtcMs, options.guardPresent ?? true,
          )
        } else if (request.sql.kind === "cleanup") {
          output = encodeQueryEnvelope(CLEANUP_MARKER, VALID_CLEANUP_RESULT)
        } else {
          output = buildTestProviderOutput(
            request.sql.kind, request.sql.sql, source, {},
          )
        }
        return { status: "success", value: request.parser(output) }
      } catch {
        return { status: "failure", reason: "schema_failure" }
      }
    },
  }
  return { dependencies, providerKinds }
}
