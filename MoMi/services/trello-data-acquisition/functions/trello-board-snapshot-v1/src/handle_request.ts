import { processSnapshot } from "./process_snapshot.ts"
import { snapshotDependencies } from "./runtime_dependencies.ts"

export function handleRequest(request: Request): Promise<Response> {
  return processSnapshot(request, snapshotDependencies)
}
