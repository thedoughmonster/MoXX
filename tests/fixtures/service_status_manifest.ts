export const serviceStatusManifest = {
  schema_version: 1,
  service_key: "status-fixture",
  purpose: "Exercise the two-axis service status contract.",
  kind: "core_capability",
  service_type: "dataset_owner",
  lifecycle_status: "active",
  functions: [],
  contracts: { provides: [], consumes: [] },
  database: { read: [], write: [] },
  network: { outbound_hosts: [] },
  secrets: [],
  runtime_dependencies: [],
  approved_packages: [],
  owned_dataset: {
    dataset_key: "fixture.status", dataset_class: "domain", private_relations: [],
  },
}
