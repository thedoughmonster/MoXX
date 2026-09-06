import { handleRequestWithReader } from "./handle_request_with_reader.ts"
import { readPolicy } from "./read_policy.ts"

export async function handleRequest(request: Request): Promise<Response> {
  return await handleRequestWithReader(request, readPolicy)
}
