export function selectPortableSchemas(schemas: string[]): {
  source: string[]
  warehouse: string[]
} {
  const source = schemas.filter((schema) =>
    schema.startsWith("toast_") ||
    schema === "momi_archive" ||
    schema === "legacy_recipe_staging"
  )
  const warehouse = schemas.filter((schema) => schema === "momi_warehouse")
  if (source.length === 0 || warehouse.length === 0) {
    throw new Error("Portable source and canonical warehouse schemas must both be configured")
  }
  return { source, warehouse }
}
