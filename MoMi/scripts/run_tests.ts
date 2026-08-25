import { spawnSync } from "node:child_process"

import { discoverTestFiles } from "./discover_test_files.ts"
import { readOption } from "./read_option.ts"

const service = readOption("service", "all")
const paths = await discoverTestFiles(service)
const result = spawnSync(process.execPath, ["--test", ...paths], {
  stdio: "inherit",
})

process.exit(result.status ?? 1)
