import Ajv2020 from "ajv/dist/2020.js"

const ajv = new Ajv2020({ allErrors: true, strict: true })

export function validateJson(
  schema: object,
  value: unknown,
  label: string,
): void {
  const validate = ajv.compile(schema)
  if (validate(value)) {
    return
  }

  const details = validate.errors?.map((error) =>
    `${error.instancePath || "/"} ${error.message}`
  ).join("; ")
  throw new Error(`${label}: ${details ?? "schema validation failed"}`)
}
