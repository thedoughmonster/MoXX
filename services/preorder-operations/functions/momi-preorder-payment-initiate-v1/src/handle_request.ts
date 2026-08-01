import { handleRequestWithDependencies } from "./handle_request_with_dependencies.ts"
import { initiateDependencies } from "./runtime_dependencies.ts"

export async function handleRequest(request: Request): Promise<Response> {
  return await handleRequestWithDependencies(request, initiateDependencies)
}
