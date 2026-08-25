import { handleRequestWithReader } from "./handle_request_with_reader.ts"
import { readBootstrap } from "./read_bootstrap.ts"

export async function handleRequest(request: Request): Promise<Response> {
  return await handleRequestWithReader(request, readBootstrap)
}
