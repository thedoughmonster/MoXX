import { MANIFEST_FILE, MANUAL_DIRECTORY, DUMP_FILE, SOURCE_EXPORT_FILE,
  WAREHOUSE_EXPORT_FILE } from "./constants.ts"
import { scanDirectoryFiles } from "./scan_directory_files.ts"
import { selectPortableSchemas } from "./select_portable_schemas.ts"
import type { ArchiveFile, DumpManifest, RunState } from "./types.ts"

export async function buildArchiveManifest(
  archivePath: string,
  state: RunState,
): Promise<DumpManifest> {
  const tree = await scanDirectoryFiles(archivePath, "")
  const manual = state.manual_files ?? []
  if (typeof state.manual_exports !== "boolean" || (!state.manual_exports && manual.length > 0)) {
    throw new Error("Export checkpoint has invalid manual file state")
  }
  const expectedNames = [DUMP_FILE, SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE,
    ...manual.map((file) => file.file)]
  if (tree.files.some((file) => file.file === MANIFEST_FILE)) expectedNames.push(MANIFEST_FILE)
  expectedNames.sort()
  if (JSON.stringify(tree.files.map((file) => file.file)) !== JSON.stringify(expectedNames)) {
    throw new Error("Published archive contains missing or unexpected files")
  }
  const expectedDirectories = new Set<string>()
  if (state.manual_exports) expectedDirectories.add(MANUAL_DIRECTORY)
  for (const file of manual) {
    const parts = file.file.split("/")
    for (let index = 2; index < parts.length; index += 1) {
      expectedDirectories.add(parts.slice(0, index).join("/"))
    }
  }
  if (JSON.stringify(tree.directories) !== JSON.stringify([...expectedDirectories].sort())) {
    throw new Error("Published archive contains missing or unexpected directories")
  }
  const found = new Map(tree.files.map((file) => [file.file, file]))
  const record = (file: string): ArchiveFile => {
    const item = found.get(file)
    if (!item || item.bytes < 1) throw new Error(`Published database artifact is empty: ${file}`)
    return { file: item.file, bytes: item.bytes, sha256: item.sha256 }
  }
  const manualFiles = manual.map((expected) => {
    const item = found.get(expected.file)
    if (!item || item.bytes !== expected.bytes || item.sha256 !== expected.sha256) {
      throw new Error(`Published manual file differs from its source: ${expected.file}`)
    }
    return { file: item.file, bytes: item.bytes, sha256: item.sha256 }
  })
  const dump = record(DUMP_FILE)
  const source = record(SOURCE_EXPORT_FILE)
  const warehouse = record(WAREHOUSE_EXPORT_FILE)
  const schemas = selectPortableSchemas(state.schemas)
  return {
    schema_version: 2,
    archive_id: state.archive_id,
    created_at: state.created_at,
    environment: state.environment,
    project_ref: state.project_ref,
    postgres_major: 17,
    format: "custom",
    compression: "gzip:9",
    schemas: [...state.schemas],
    dump: { ...dump, file: DUMP_FILE },
    portable_exports: {
      source: { ...source, file: SOURCE_EXPORT_FILE, format: "plain-sql",
        compression: "gzip:9", schemas: schemas.source },
      warehouse: { ...warehouse, file: WAREHOUSE_EXPORT_FILE, format: "plain-sql",
        compression: "gzip:9", schemas: schemas.warehouse },
    },
    manual_export_included: state.manual_exports,
    manual_files: manualFiles,
  }
}
