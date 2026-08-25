import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

import { APPROVED_TABLES } from
  "../local-tools/legacy-recipe-import/constants.ts"
import type { PortableManifest } from
  "../local-tools/legacy-recipe-import/manifest_types.ts"
import { sha256Text } from
  "../local-tools/legacy-recipe-import/sha256_text.ts"
import type { PackageTrust } from
  "../local-tools/legacy-recipe-import/types.ts"

export async function createLegacyRecipeTestPackage(): Promise<{
  root: string
  manifestPath: string
  sourcePath: string
  findingPath: string
  manifest: PortableManifest
  trust: PackageTrust
  reseal: () => Promise<void>
}> {
  const root = await mkdtemp(join(tmpdir(), "momi-legacy-recipe-"))
  const portable = join(root, "portable")
  const tablesRoot = join(portable, "tables")
  const databases = join(root, "databases")
  await mkdir(tablesRoot, { recursive: true })
  await mkdir(databases)
  const databaseText = "sealed sqlite fixture\n"
  const apiDatabaseText = "sealed api sqlite fixture\n"
  await writeFile(join(databases, "toast.sqlite"), databaseText)
  await writeFile(join(databases, "toast-api.sqlite"), apiDatabaseText)
  const tableEntries = []
  for (const table of APPROVED_TABLES) {
    const rows = table === "recipe_versions" ?
      [{ id: 1, name: "O'Brien Glaze", yield: 12, fixture_id: basename(root) }] : []
    const text = `${JSON.stringify(rows, null, 2)}\n`
    await writeFile(join(tablesRoot, `${table}.json`), text)
    tableEntries.push({
      table, relative_path: `portable/tables/${table}.json`,
      format: "json_array_of_objects" as const, encoding: "UTF-8" as const,
      order_by: ["id"], schema_sql: `create table ${table} (id integer primary key)`,
      columns: [], sqlite_row_count: rows.length, reread_json_row_count: rows.length,
      bytes: Buffer.byteLength(text), sha256: sha256Text(text),
    })
  }
  const findings = [{
    finding_id: "unit:ingredient:1", category: "unit_basis_review",
    scope: "recipe_ingredient",
    logical_identity: { recipe_version_id: 1, ingredient_id: 1 },
    evidence: { message: "Confirm ounce-to-pound basis" },
  }]
  const findingDocument = {
    format_version: 1, generated_at_utc: "2026-07-16T18:25:57.000Z",
    source_database: "../databases/toast.sqlite", source_queries: ["fixture"],
    status: "review_required", canonical_truth: false, definitions: {},
    audited_expectations: {}, observed_aggregates: {}, reconciliation_passed: true,
    finding_count: findings.length, findings,
  }
  const findingText = `${JSON.stringify(findingDocument, null, 2)}\n`
  const findingPath = join(portable, "repair_findings.json")
  await writeFile(findingPath, findingText)
  await writeFile(join(portable, "repair_queries.sql"), "-- fixture only\n")
  const manifest = {
    format_version: 1, generated_at_utc: "2026-07-16T18:25:57.000Z",
    purpose: "Portable source-shaped fixture; not canonical truth.",
    source_database: {
      relative_path: "../databases/toast.sqlite", sha256: sha256Text(databaseText),
      verification: { integrity_check: "ok", foreign_key_check_rows: 0 },
    },
    deterministic_ordering: "Primary-key order.",
    table_export_count: APPROVED_TABLES.length, tables: tableEntries,
    repair_findings: {
      relative_path: "repair_findings.json",
      format: "json_object_with_findings_array" as const, encoding: "UTF-8" as const,
      finding_count: 1, observed_aggregates: {}, bytes: Buffer.byteLength(findingText),
      sha256: sha256Text(findingText), reread_finding_count: 1,
      reconciliation_passed: true,
    }, excluded_domains: [],
  } as PortableManifest
  const manifestPath = join(portable, "manifest.json")
  const trust = {
    ledgerSha256: "", manifestSha256: "", databases: {
      "databases/toast.sqlite": sha256Text(databaseText),
      "databases/toast-api.sqlite": sha256Text(apiDatabaseText),
    },
  }
  const reseal = async () => {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    const paths = [
      "databases/toast-api.sqlite", "databases/toast.sqlite", "portable/manifest.json",
      "portable/repair_findings.json", "portable/repair_queries.sql",
      ...APPROVED_TABLES.map((table) => `portable/tables/${table}.json`),
    ].sort()
    const lines = []
    for (const path of paths) {
      lines.push(`${sha256Text(await readFile(join(root, ...path.split("/")), "utf8"))}  ${path}`)
    }
    const ledger = `${lines.join("\n")}\n`
    await writeFile(join(root, "SHA256SUMS.txt"), ledger)
    trust.manifestSha256 = sha256Text(await readFile(manifestPath, "utf8"))
    trust.ledgerSha256 = sha256Text(ledger)
    await writeFile(
      join(root, "SHA256SUMS.txt.sha256"),
      `${trust.ledgerSha256}  SHA256SUMS.txt\n`,
    )
  }
  await reseal()
  const sourcePath = join(tablesRoot, "recipe_versions.json")
  return { root, manifestPath, sourcePath, findingPath, manifest, trust, reseal }
}
