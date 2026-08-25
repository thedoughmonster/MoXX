import { createHash, randomUUID } from "node:crypto"
import { appendFile, readFile } from "node:fs/promises"

import { extractGatewayOutput } from "./extract_gateway_output.ts"

async function run(): Promise<void> {
  const endpoint = process.env.MOMI_MODEL_EXECUTION_GATEWAY_URL?.trim()
  const secret = process.env.MOMI_MODEL_GATEWAY_TRIAGE_SECRET?.trim()
  const output = process.env.GITHUB_OUTPUT
  const issueNumber = process.env.TRIAGE_ISSUE_NUMBER?.trim()
  if (!endpoint || !secret || !output || !issueNumber) {
    throw new Error("Missing issue-triage gateway configuration")
  }
  const [instructions, context, schemaText] = await Promise.all([
    readFile(".github/codex/issue-triage-prompt.md", "utf8"),
    readFile(".github/codex/issue-context.json", "utf8"),
    readFile(".github/codex/issue-triage.schema.json", "utf8"),
  ])
  const contextHash = createHash("sha256").update(context).digest("hex")
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ schema_version: 1, operation: "create",
      purpose_key: "github.issue-triage", profile_key: "default",
      parent_invocation_id: `github-issue:${issueNumber}`,
      idempotency_key: `github-issue:${issueNumber}:${contextHash}`,
      deadline_at: new Date(Date.now() + 480_000).toISOString(),
      requested_output_tokens: 2000, background: false,
      payload: { instructions, input: context, text: { format: {
        type: "json_schema", name: "issue_triage", strict: true,
        schema: JSON.parse(schemaText) } } } }),
    signal: AbortSignal.timeout(480_000),
  })
  const envelope: unknown = await response.json()
  if (!response.ok || !envelope || typeof envelope !== "object" ||
      Array.isArray(envelope)) throw new Error(`Model gateway returned ${response.status}`)
  const result = envelope as Record<string, unknown>
  const text = result.ok === true ? extractGatewayOutput(result.body) : null
  if (!text) throw new Error("Model gateway returned no triage output")
  JSON.parse(text)
  const delimiter = `momi_triage_${randomUUID()}`
  await appendFile(output, `result<<${delimiter}\n${text}\n${delimiter}\n`)
}

await run()
