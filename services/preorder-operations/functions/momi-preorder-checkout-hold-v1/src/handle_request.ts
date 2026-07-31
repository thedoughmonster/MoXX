import { execute } from "./execute.ts";
import { handleRequestWithExecutor } from "./handle_request_with_executor.ts";

export async function handleRequest(request: Request): Promise<Response> {
  return await handleRequestWithExecutor(request, execute);
}
