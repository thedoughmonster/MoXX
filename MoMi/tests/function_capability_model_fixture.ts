import type {
  Architecture,
  LoadedFunction,
  LoadedService,
} from "../scripts/architecture/types.ts"
import { inspectRawFunctionCapabilityModel } from
  "../scripts/architecture/inspect_raw_function_capability_model.ts"

export type CapabilityServiceDefinition = {
  key: string
  provides?: string[]
  consumes?: Array<{ service: string; contract: string }>
  database_read?: string[]
  database_write?: string[]
  hosts?: string[]
  secrets?: string[]
  dependencies?: string[]
  packages?: string[]
}

export type CapabilityFunctionDefinition = {
  key: string
  owner: string
  slug?: string
  direct?: string[]
  called?: Array<{ service: string; contract: string }>
  absent?: boolean
}

export function createCapabilityArchitecture(
  serviceDefinitions: CapabilityServiceDefinition[],
  functionDefinitions: CapabilityFunctionDefinition[],
): Pick<Architecture, "services" | "functions"> {
  const services = serviceDefinitions.map((definition) => ({
    directory: `/repository/services/${definition.key}`,
    manifest: {
      service_key: definition.key,
      contracts: {
        provides: definition.provides ?? [],
        consumes: definition.consumes ?? [],
      },
      database: {
        read: definition.database_read ?? [],
        write: definition.database_write ?? [],
      },
      network: { outbound_hosts: definition.hosts ?? [] },
      secrets: definition.secrets ?? [],
      runtime_dependencies: definition.dependencies ?? [],
      approved_packages: definition.packages ?? [],
    },
  }) as unknown as LoadedService)
  const byKey = new Map(services.map((service) =>
    [service.manifest.service_key, service]))
  const functions = functionDefinitions.map((definition) => {
    const slug = definition.slug ?? definition.key.replaceAll(".", "-")
    const capability_model = definition.absent ? undefined : {
      schema_version: 1 as const,
      called_contracts: definition.called ?? [],
    }
    const loaded = {
      slug,
      service: byKey.get(definition.owner),
      manifest: {
        function_key: definition.key,
        owner_service: definition.owner,
        required_capabilities: definition.direct ?? [],
        declared_side_effects: [],
        capability_model,
      },
    }
    if (!definition.absent) {
      const path = `services/${definition.owner}/functions/${slug}/function.json`
      const diagnostics = inspectRawFunctionCapabilityModel(loaded.manifest, path)
      if (diagnostics.length > 0) {
        throw new Error(`invalid capability fixture: ${JSON.stringify(diagnostics)}`)
      }
    }
    return loaded as unknown as LoadedFunction
  })
  return { services, functions }
}
