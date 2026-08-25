import { handleStockRequest } from "../../../src/handle_stock_request.ts"
import type { StockReadContract } from "../../../src/types.ts"

const contract: StockReadContract = {
  functionKey: "momi.stock_observations.get_latest.v1",
  viewName: "stock_observations_latest_v1",
}

export function handleRequest(request: Request): Promise<Response> {
  return handleStockRequest(request, contract)
}
