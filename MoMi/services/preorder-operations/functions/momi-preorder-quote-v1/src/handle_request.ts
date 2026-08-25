import { createQuote } from "./create_quote.ts";
import { handleRequestWithCreator } from "./handle_request_with_creator.ts";

export async function handleRequest(request: Request): Promise<Response> {
  return await handleRequestWithCreator(request, createQuote);
}
