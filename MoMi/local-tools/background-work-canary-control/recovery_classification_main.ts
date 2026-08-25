import { invokeRecoveryClassificationMain } from "./invoke_recovery_classification_main.ts"

process.exitCode = await invokeRecoveryClassificationMain(process.argv.slice(2), import.meta.url)
