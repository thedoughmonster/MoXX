import { validateArchitecture } from "./architecture/validate_architecture.ts"

const architecture = await validateArchitecture()

console.log(
  `Architecture valid: ${architecture.services.length} services, ` +
    `${architecture.functions.length} functions.`,
)
