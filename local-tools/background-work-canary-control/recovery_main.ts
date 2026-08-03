import { invokeRecoveryCanaryMain } from "./invoke_recovery_canary_main.ts"

process.exitCode = await invokeRecoveryCanaryMain(process.argv.slice(2), import.meta.url)
