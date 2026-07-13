import "edge-runtime"

import { handleRequest } from "./handle_request.ts"

Deno.serve(handleRequest)
