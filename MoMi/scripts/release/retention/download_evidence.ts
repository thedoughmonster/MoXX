import { mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCommand } from "../run_command.ts"
import { hashText } from "../../dev_loop/hash_text.ts"

export function downloadRetentionEvidence(
  runId: number, artifactName: string, filename: string, expectedSha256: string,
  artifactId?: number,
): unknown {
  const repository = "thedoughmonster/MoXX"
  const metadata = JSON.parse(runCommand("gh", ["api",
    `repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`], { capture: true }).stdout)
  const matches = metadata.artifacts?.filter((item: { name: string; expired: boolean }) =>
    item.name === artifactName && !item.expired)
  if (!Array.isArray(matches) || matches.length !== 1) throw new Error("Exact evidence artifact unavailable")
  if (artifactId !== undefined && matches[0].id !== artifactId) throw new Error("Artifact identity changed")
  const directory = mkdtempSync(join(tmpdir(), "momi-retention-evidence-"))
  runCommand("gh", ["run", "download", String(runId), "--repo", repository,
    "--name", artifactName, "--dir", directory], { capture: true })
  const paths = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === filename)
  if (paths.length !== 1) throw new Error("Exact evidence receipt unavailable")
  const source = readFileSync(join(paths[0].parentPath, paths[0].name), "utf8")
  if (hashText(source) !== expectedSha256) throw new Error("Evidence receipt digest mismatch")
  return JSON.parse(source)
}
