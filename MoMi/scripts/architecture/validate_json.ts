import Ajv2020 from "ajv/dist/2020.js"

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

  const details = validate.errors?.map((error) =>
    `${error.instancePath || "/"} ${error.message}`
  ).join("; ")
  throw new Error(`${label}: ${details ?? "schema validation failed"}`)
}
