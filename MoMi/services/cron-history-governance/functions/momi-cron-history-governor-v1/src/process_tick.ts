import { functionKey } from "./types.ts";
import type {
  GovernorDependencies,
  ProcessResult,
  ProviderMetricSample,
  TickInput,
} from "./types.ts";

export async function processTick(
  input: TickInput,
  dependencies: GovernorDependencies,
): Promise<ProcessResult> {
  const claim = await dependencies.claim(input);
  if (!claim) {
    return {
      status: 401,
      body: {
        ok: false,
        function_key: functionKey,
        tick_id: input.tick_id,
        disposition: "unknown_tick",
        phase: null,
        receipt: null,
      },
    };
  }
  if (claim.tick_status === "completed") {
    const receipt = await dependencies.readReceipt(input);
    return {
      status: receipt ? 200 : 503,
      body: receipt && typeof receipt === "object"
        ? receipt as Record<string, unknown>
        : {
          ok: false,
          function_key: functionKey,
          tick_id: input.tick_id,
          disposition: "receipt_missing",
          phase: claim.phase,
          receipt: null,
        },
    };
  }
  let sample: ProviderMetricSample;
  try {
    sample = await dependencies.collect();
  } catch {
    sample = {
      sourceObservedAt: new Date().toISOString(),
      cpuTotalSeconds: null,
      cpuIdleSeconds: null,
      ramPct: null,
      swapUsedBytes: null,
      ioBusySeconds: null,
      allocatedDiskPct: null,
      providerConnections: null,
      providerWarning: null,
      sourceComplete: false,
    };
  }
  try {
    const result = await dependencies.record(input, sample);
    return { status: 200, body: result as Record<string, unknown> };
  } catch {
    const receipt = await dependencies.readReceipt(input).catch(() => null);
    if (receipt && typeof receipt === "object") {
      return { status: 200, body: receipt as Record<string, unknown> };
    }
    return {
      status: 503,
      body: {
        ok: false,
        function_key: functionKey,
        tick_id: input.tick_id,
        disposition: "unknown_commit",
        phase: claim.phase,
        receipt: null,
      },
    };
  }
}
