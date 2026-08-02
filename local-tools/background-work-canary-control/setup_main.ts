import { invokeSetupMain } from "./invoke_setup_main.ts"

process.exitCode = await invokeSetupMain(process.argv.slice(2), import.meta.url)
