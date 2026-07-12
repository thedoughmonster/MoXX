import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { handleRequest } from "./handle_request.ts"

Deno.serve(handleRequest)
