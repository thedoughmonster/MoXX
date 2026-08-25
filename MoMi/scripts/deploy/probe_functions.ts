import type { LoadedFunction } from "../architecture/types.ts"
import { isAcceptableProbeStatus } from "./is_acceptable_probe_status.ts"
import type { ProbeResult } from "./types.ts"

export async function probeFunctions(
  projectRef: string,
  functions: LoadedFunction[],
): Promise<ProbeResult[]> {
  return await Promise.all(functions.map(async (item) => {
    const url = `https://${projectRef}.supabase.co${item.manifest.route_path}`
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    await response.body?.cancel()
    return {
      slug: item.slug,
      status: response.status,
      ok: isAcceptableProbeStatus(response.status),
    }
  }))
}
