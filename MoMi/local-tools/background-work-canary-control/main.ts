import { invokeCanaryControlMain } from "./invoke_canary_control_main.ts"

process.exitCode = await invokeCanaryControlMain(process.argv.slice(2), import.meta.url)
