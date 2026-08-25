with reconciliation as (
  select *
  from momi_governance.bootstrap_reconciliations
  where source_ledger_key = 'project-baseline-pre-ledger-v1'
), mapped as (
  select (entry.value->>'decision_id')::uuid as decision_id
  from reconciliation
  cross join lateral jsonb_each(reconciliation.decision_mapping) entry
), receipt as (
  select
    (select count(*)::integer from mapped
      join momi_governance.material_decisions using (decision_id)) as decisions,
    (select count(*)::integer from mapped
      join momi_governance.decision_events using (decision_id)) as events,
    (select count(*)::integer from reconciliation) as reconciliations,
    (select count(*)::integer from reconciliation
      cross join lateral jsonb_object_keys(decision_mapping)) as mapping_entries,
    (select reconciliation_id from reconciliation) as reconciliation_id,
    (select manifest_digest from reconciliation) as manifest_digest,
    (select mapping_digest from reconciliation) as mapping_digest,
    (select reconciled_at from reconciliation) as reconciled_at,
    (select decision_mapping from reconciliation) as decision_mapping
)
select jsonb_build_object(
  'schema_version', 1,
  'valid', decisions = 6 and events = 12 and reconciliations = 1
    and mapping_entries = 6
    and manifest_digest =
      'd89d4c426419976631b1e411f516eea915176a6e20690d8944e7600487da8b2a'
    and mapping_digest ~ '^[0-9a-f]{64}$',
  'decisions', decisions,
  'events', events,
  'reconciliations', reconciliations,
  'mapping_entries', mapping_entries,
  'reconciliation_id', reconciliation_id,
  'manifest_digest', manifest_digest,
  'mapping_digest', mapping_digest,
  'reconciled_at', reconciled_at,
  'decision_mapping', decision_mapping
) as project_baseline_bootstrap_receipt
from receipt;
