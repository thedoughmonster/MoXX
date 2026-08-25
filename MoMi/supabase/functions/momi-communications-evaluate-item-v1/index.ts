import "edge-runtime"
import { handleRequest } from "../../../services/communications-evaluation/functions/momi-communications-evaluate-item-v1/src/handle_request.ts"

Deno.serve(handleRequest)
