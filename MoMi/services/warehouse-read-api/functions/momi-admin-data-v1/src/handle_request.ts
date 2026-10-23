import { handleAdminRequest } from "../../../src/handle_admin_request.ts"
import { readAdminSales } from "../../../src/read_admin_sales.ts"

export function handleRequest(request: Request): Promise<Response> {
  return handleAdminRequest(request, {
    token: Deno.env.get("MOMI_ADMIN_DATA_TOKEN"),
    read: readAdminSales,
  })
}
