import { runCommand } from "./run_command.ts"

type PromotionPullRequest = {
  number: number
  headRefOid: string
  isDraft: boolean
}

export function ensurePromotionPullRequest(
  expectedHeadSha: string,
  devReceiptSha256: string,
): number {
  const listArguments = [
    "pr", "list", "--base", "prod", "--head", "dev", "--state", "open",
    "--limit", "10", "--json", "number,headRefOid,isDraft",
  ]
  let records = JSON.parse(
    runCommand("gh", listArguments, { capture: true }).stdout,
  ) as PromotionPullRequest[]
  if (records.length > 1) throw new Error("Multiple open dev-to-prod PRs")
  if (records.length === 0) {
    runCommand("gh", [
      "pr", "create", "--base", "prod", "--head", "dev",
      "--title", "Promote development to production",
      "--body",
      `Exact validated development receipt: sha256:${devReceiptSha256}`,
    ])
    records = JSON.parse(
      runCommand("gh", listArguments, { capture: true }).stdout,
    ) as PromotionPullRequest[]
  }
  const record = records[0]
  if (!record) throw new Error("Could not resolve the dev-to-prod PR")
  if (record.headRefOid !== expectedHeadSha) {
    throw new Error(`Promotion PR does not point to ${expectedHeadSha}`)
  }
  if (record.isDraft) runCommand("gh", ["pr", "ready", String(record.number)])
  return record.number
}
