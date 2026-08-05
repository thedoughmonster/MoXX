import "edge-runtime";
import { handleRequest } from "../../../services/cron-history-governance/functions/momi-cron-history-governor-v1/src/handle_request.ts";

Deno.serve(handleRequest);
