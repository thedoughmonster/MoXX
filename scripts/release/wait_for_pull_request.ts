import { setTimeout as sleep } from "node:timers/promises"

import { runCommand } from "./run_command.ts"

export async function waitForPullRequest(number: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const check = runCommand("gh", ["pr", "checks", String(number)], {
      capture: true,
      allowFailure: true,
    })
    const detail = `${check.stdout}\n${check.stderr}`
    if (check.status === 0 && check.stdout.trim()) return
    if (check.status === 8) {
      runCommand("gh", [
        "pr", "checks", String(number), "--watch", "--fail-fast",
        "--interval", "10",
      ])
      return
    }
    if (/no checks reported/i.test(detail)) {
      await sleep(3000)
      continue
    }
    throw new Error(`PR #${number} checks failed: ${detail.trim()}`)
  }
  throw new Error(`Timed out waiting for checks on PR #${number}`)
}
