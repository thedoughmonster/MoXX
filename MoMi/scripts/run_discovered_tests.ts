import { spawnSync } from "node:child_process"

import { discoverTestFiles } from "./discover_test_files.ts"
import { readOption } from "./read_option.ts"

const paths = await discoverTestFiles(readOption("service", "all"))
const result = spawnSync(process.execPath, ["--test", ...paths], {
  stdio: "inherit",
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
