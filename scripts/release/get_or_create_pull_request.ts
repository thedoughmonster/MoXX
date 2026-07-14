import { runCommand } from "./run_command.ts"
import type { PullRequestRecord } from "./types.ts"

export function getOrCreatePullRequest(
  base: string,
  head: string,
  expectedHeadSha: string,
  title: string,
  body: string,
): PullRequestRecord {
  const listArgs = [
    "pr", "list", "--base", base, "--head", head, "--state", "open",
    "--limit", "10", "--json", "number,headRefOid,isDraft",
  ]
  let records = JSON.parse(
    runCommand("gh", listArgs, { capture: true }).stdout,
  ) as PullRequestRecord[]
  if (records.length > 1) throw new Error(`Multiple open ${head}-to-${base} PRs`)
  if (records.length === 0) {
    runCommand("gh", [
      "pr", "create", "--base", base, "--head", head,
      "--title", title, "--body", body,
    ])
    records = JSON.parse(
      runCommand("gh", listArgs, { capture: true }).stdout,
    ) as PullRequestRecord[]
  }
  const record = records[0]
  if (!record) throw new Error(`Could not resolve the ${head}-to-${base} PR`)
  if (record.headRefOid !== expectedHeadSha) {
    throw new Error(`PR #${record.number} does not point to ${expectedHeadSha}`)
  }
  if (record.isDraft) runCommand("gh", ["pr", "ready", String(record.number)])
  return { ...record, isDraft: false }
}
