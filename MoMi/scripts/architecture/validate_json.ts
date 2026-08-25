import Ajv2020 from "ajv/dist/2020.js"

import { manifestDiagnostic } from "../diagnostics/manifest_diagnostic.ts"
import { RepositoryDiagnosticError } from
  "../diagnostics/repository_diagnostic_error.ts"

export function validateJson(
  schema: object,
  value: unknown,
  label: string,
): void {
  // Validation callers may load the same schema from disk more than once in a
  // single release process. Keep each validation isolated so AJV does not
  // mistake those equivalent schema objects for duplicate registrations.
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(schema)
  if (validate(value)) {
    return
  }

  const details = validate.errors?.map((error) => {
    const instancePath = error.keyword === "additionalProperties"
      ? `${error.instancePath}/${error.params.additionalProperty}`
      : error.instancePath || "/"
    return `${instancePath} ${error.message}`
  }).join("; ")
  const message = `${label}: ${details ?? "schema validation failed"}`
  const id = (schema as { $id?: unknown }).$id
  const schemaName = typeof id === "string" ? id.split("/").at(-1)! : "manifest schema"
  const diagnostic = manifestDiagnostic(label, schemaName, message)
  if (diagnostic) throw new RepositoryDiagnosticError(message, [diagnostic])
  throw new Error(message)
}
