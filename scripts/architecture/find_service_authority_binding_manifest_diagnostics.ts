import { digestServiceAuthorityValue } from
  "./digest_service_authority_value.ts"
import type {
  ServiceAuthorityBinding,
  ServiceAuthorityBindingContext,
  ServiceAuthorityBindingDiagnostic,
} from "./service_authority_binding_types.ts"

export function findServiceAuthorityBindingManifestDiagnostics(
  binding: ServiceAuthorityBinding,
  context: ServiceAuthorityBindingContext,
): ServiceAuthorityBindingDiagnostic[] {
  const diagnostics: ServiceAuthorityBindingDiagnostic[] = []
  const manifest = context.manifests[binding.service]
  const report = (
    layer: "target" | "runtime", source_path: string,
    json_pointer: string, code: string, target: string,
  ) => diagnostics.push({ service: binding.service, layer, source_path,
    json_pointer, code, target, message: `${code}: ${target}` })
  if (!manifest) {
    report("target", `services/${binding.service}/service.json`,
      "/owned_dataset", "missing_source", binding.service)
    report("runtime", `services/${binding.service}/service.json`,
      "/database", "missing_source", binding.service)
    return diagnostics
  }
  const expectedPath = manifest.source_path
  const target = binding.target_authority
  if (!target) {
    if (manifest.value.owned_dataset !== undefined) {
      report("target", expectedPath, "/owned_dataset",
        "target_reference_missing", binding.service)
    }
  } else {
    if (target.source_path === context.debt.source_path) {
      report("target", target.source_path, target.json_pointer,
        "debt_derived_authority", target.source_path)
    }
    if (target.json_pointer === "/database") {
      report("target", target.source_path, target.json_pointer,
        "runtime_as_owner", binding.service)
    }
    if (target.source_path !== expectedPath) {
      report("target", target.source_path, target.json_pointer,
        "source_path_mismatch", expectedPath)
    }
    if (target.json_pointer !== "/owned_dataset") {
      report("target", target.source_path, target.json_pointer,
        "pointer_mismatch", "/owned_dataset")
    }
    if (manifest.value.owned_dataset === undefined) {
      report("target", target.source_path, target.json_pointer,
        "target_absent", binding.service)
    } else if (target.value_digest !==
      digestServiceAuthorityValue(manifest.value.owned_dataset)) {
      report("target", target.source_path, target.json_pointer,
        "value_digest_drift", target.value_digest)
    }
  }
  const runtime = binding.runtime_compatibility
  if (runtime.source_path === context.debt.source_path) {
    report("runtime", runtime.source_path, runtime.json_pointer,
      "debt_derived_authority", runtime.source_path)
  }
  if (runtime.source_path !== expectedPath) {
    report("runtime", runtime.source_path, runtime.json_pointer,
      "source_path_mismatch", expectedPath)
  }
  if (runtime.json_pointer !== "/database") {
    report("runtime", runtime.source_path, runtime.json_pointer,
      "pointer_mismatch", "/database")
  }
  if (runtime.value_digest !==
    digestServiceAuthorityValue(manifest.value.database)) {
    report("runtime", runtime.source_path, runtime.json_pointer,
      "value_digest_drift", runtime.value_digest)
  }
  return diagnostics
}
