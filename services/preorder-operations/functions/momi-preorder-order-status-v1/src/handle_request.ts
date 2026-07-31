import { handleRequestWithReader } from "./handle_request_with_reader.ts";
import { readStatus } from "./read_status.ts";

export async function handleRequest(request: Request): Promise<Response> {
  return await handleRequestWithReader(request, readStatus);
}
