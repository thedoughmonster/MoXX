import type { ClaimedWork, ExecutionResult } from "./types.ts"

export function failedDeliveryResult(
  work: ClaimedWork,
  status: number,
  error: string,
): ExecutionResult {
  return {
    status,
    body: {
      ok: false,
      disposition: "failed",
      work_id: work.work_id,
      attempt_id: work.attempt_id,
      invocation_id: work.invocation_id,
      error,
    },
  }
}
