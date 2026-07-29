import { processWebhook } from "./process_webhook.ts"
import { ingestionDependencies } from "./runtime_dependencies.ts"

export function handleRequest(request: Request): Promise<Response> {
  return processWebhook(request, ingestionDependencies)
}
