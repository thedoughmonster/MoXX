-- service-owner: project-baseline-governance
create schema momi_governance;

revoke all on schema momi_governance from public, anon, authenticated, service_role;

create table momi_governance.material_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind ~ '^[a-z][a-z0-9_]*$'),
  source_decision_id text not null check (btrim(source_decision_id) <> ''),
  source_identity_digest text not null
    check (source_identity_digest ~ '^[0-9a-f]{64}$'),
  source_identity_preimage jsonb not null,
  category text not null check (category in (
    'scope', 'architecture_contract', 'data_security_ops',
    'rollout_production', 'debt_acceptance', 'supersession', 'governance'
  )),
  canonical_identity jsonb not null,
  identity_digest text not null check (identity_digest ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  constraint material_decisions_source_unique
    unique (source_kind, source_decision_id)
);

create table momi_governance.decision_events (
  event_id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references momi_governance.material_decisions,
  decision_version integer not null check (decision_version > 0),
  lifecycle_status text not null check (lifecycle_status in (
    'proposed', 'accepted', 'rejected', 'superseded', 'revoked'
  )),
  event_source_kind text not null
    check (event_source_kind ~ '^[a-z][a-z0-9_]*$'),
  event_source_id text not null check (btrim(event_source_id) <> ''),
  event_source_digest text not null
    check (event_source_digest ~ '^[0-9a-f]{64}$'),
  event_source_preimage jsonb not null,
  caller_idempotency_key text not null
    check (btrim(caller_idempotency_key) <> ''),
  decision_text text not null check (btrim(decision_text) <> ''),
  rationale text not null check (btrim(rationale) <> ''),
  alternatives jsonb not null default '[]'::jsonb
    check (jsonb_typeof(alternatives) = 'array'),
  consequences jsonb not null default '[]'::jsonb
    check (jsonb_typeof(consequences) = 'array'),
  decided_by text not null check (btrim(decided_by) <> ''),
  occurred_at timestamptz not null,
  source_snapshot text not null check (btrim(source_snapshot) <> ''),
  related_decision_id uuid references momi_governance.material_decisions,
  evidence_manifest jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_manifest) = 'array'),
  external_reference_manifest jsonb not null default '[]'::jsonb
    check (jsonb_typeof(external_reference_manifest) = 'array'),
  canonical_document jsonb not null,
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  constraint decision_events_version_unique
    unique (decision_id, decision_version),
  constraint decision_events_id_decision_unique
    unique (event_id, decision_id),
  constraint decision_events_source_unique
    unique (event_source_kind, event_source_id),
  constraint decision_events_idempotency_unique
    unique (caller_idempotency_key),
  constraint decision_events_relation_shape check (
    (lifecycle_status = 'superseded' and related_decision_id is not null)
    or
    (lifecycle_status <> 'superseded' and related_decision_id is null)
  ),
  constraint decision_events_not_self_related
    check (related_decision_id is null or related_decision_id <> decision_id)
);

create index decision_events_related_decision_idx
  on momi_governance.decision_events (related_decision_id)
  where related_decision_id is not null;

create table momi_governance.decision_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  decision_id uuid not null,
  evidence_ordinal integer not null check (evidence_ordinal > 0),
  evidence_key text not null check (btrim(evidence_key) <> ''),
  evidence_kind text not null check (btrim(evidence_kind) <> ''),
  evidence_digest text not null check (evidence_digest ~ '^[0-9a-f]{64}$'),
  digest_preimage jsonb not null,
  source_snapshot text not null check (btrim(source_snapshot) <> ''),
  locator text not null check (btrim(locator) <> ''),
  summary text not null,
  canonical_document jsonb not null,
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  constraint decision_evidence_event_key_unique unique (event_id, evidence_key),
  constraint decision_evidence_event_ordinal_unique
    unique (event_id, evidence_ordinal),
  constraint decision_evidence_event_decision_fkey
    foreign key (event_id, decision_id)
    references momi_governance.decision_events (event_id, decision_id)
);

create index decision_evidence_decision_idx
  on momi_governance.decision_evidence (decision_id);

create table momi_governance.decision_external_references (
  reference_id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  decision_id uuid not null,
  reference_ordinal integer not null check (reference_ordinal > 0),
  reference_key text not null check (btrim(reference_key) <> ''),
  reference_kind text not null check (btrim(reference_kind) <> ''),
  reference_digest text not null check (reference_digest ~ '^[0-9a-f]{64}$'),
  digest_preimage jsonb not null,
  locator text not null check (btrim(locator) <> ''),
  canonical_document jsonb not null,
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  constraint decision_references_event_key_unique unique (event_id, reference_key),
  constraint decision_references_event_ordinal_unique
    unique (event_id, reference_ordinal),
  constraint decision_references_event_decision_fkey
    foreign key (event_id, decision_id)
    references momi_governance.decision_events (event_id, decision_id)
);

create index decision_external_references_decision_idx
  on momi_governance.decision_external_references (decision_id);

create table momi_governance.bootstrap_reconciliations (
  reconciliation_id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  source_ledger_key text not null unique check (
    source_ledger_key = 'project-baseline-pre-ledger-v1'
  ),
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  entry_count integer not null check (entry_count > 0),
  decision_mapping jsonb not null check (jsonb_typeof(decision_mapping) = 'object'),
  mapping_digest text not null check (mapping_digest ~ '^[0-9a-f]{64}$'),
  reconciled_by text not null check (btrim(reconciled_by) <> ''),
  reconciled_at timestamptz not null default clock_timestamp()
);

alter table momi_governance.material_decisions enable row level security;
alter table momi_governance.material_decisions force row level security;
alter table momi_governance.decision_events enable row level security;
alter table momi_governance.decision_events force row level security;
alter table momi_governance.decision_evidence enable row level security;
alter table momi_governance.decision_evidence force row level security;
alter table momi_governance.decision_external_references enable row level security;
alter table momi_governance.decision_external_references force row level security;
alter table momi_governance.bootstrap_reconciliations enable row level security;
alter table momi_governance.bootstrap_reconciliations force row level security;

create function momi_governance.canonical_timestamp_v1(p_value timestamptz)
returns text language sql stable security invoker set search_path = '' as $$
  select to_char(
    p_value at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  );
$$;

create function momi_governance.canonicalize_provenance_preimage_v1(
  p_preimage jsonb
) returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_preimage is null
    or jsonb_typeof(p_preimage) <> 'object'
    or p_preimage->>'schema_version' <> '1'
    or p_preimage->>'encoding' <> 'utf-8'
    or coalesce(jsonb_typeof(p_preimage->'content'), '') <> 'string'
    or (p_preimage - 'schema_version' - 'encoding' - 'content') <> '{}'::jsonb
  then
    raise exception 'Provenance preimage must contain only schema_version 1, utf-8 encoding, and string content'
      using errcode = '22023';
  end if;
  return jsonb_build_object(
    'schema_version', 1,
    'encoding', 'utf-8',
    'content', p_preimage->>'content'
  );
end;
$$;

create function momi_governance.provenance_digest_v1(p_preimage jsonb)
returns text language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_preimage jsonb;
begin
  v_preimage := momi_governance.canonicalize_provenance_preimage_v1(p_preimage);
  return encode(extensions.digest(
    convert_to(v_preimage->>'content', 'UTF8'), 'sha256'
  ), 'hex');
end;
$$;

create function momi_governance.canonicalize_evidence_v1(p_items jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_item jsonb;
  v_key text;
  v_preimage jsonb;
  v_digest text;
  v_seen jsonb := '{}'::jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  p_items := coalesce(p_items, '[]'::jsonb);
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Evidence must be an array' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Every evidence entry must be an object'
        using errcode = '22023';
    end if;
    v_key := v_item->>'evidence_key';
    v_preimage := momi_governance.canonicalize_provenance_preimage_v1(
      v_item->'digest_preimage'
    );
    v_digest := momi_governance.provenance_digest_v1(v_preimage);
    if nullif(btrim(v_key), '') is null
      or nullif(btrim(v_item->>'evidence_kind'), '') is null
      or nullif(btrim(v_item->>'source_snapshot'), '') is null
      or nullif(btrim(v_item->>'locator'), '') is null
    then
      raise exception 'Evidence key, kind, snapshot, and locator are required'
        using errcode = '22023';
    end if;
    if nullif(v_item->>'evidence_digest', '') is not null
      and (
        v_item->>'evidence_digest' !~ '^[0-9a-f]{64}$'
        or v_item->>'evidence_digest' <> v_digest
      )
    then
      raise exception 'Evidence digest does not match its canonical preimage'
        using errcode = '23514';
    end if;
    if v_seen ? v_key then
      raise exception 'Evidence keys must be unique within an event'
        using errcode = '23505';
    end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'evidence_key', v_key,
      'evidence_kind', v_item->>'evidence_kind',
      'digest_preimage', v_preimage,
      'evidence_digest', v_digest,
      'source_snapshot', v_item->>'source_snapshot',
      'locator', v_item->>'locator',
      'summary', coalesce(v_item->>'summary', '')
    ));
  end loop;
  return v_result;
end;
$$;

create function momi_governance.canonicalize_external_references_v1(p_items jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_item jsonb;
  v_key text;
  v_preimage jsonb;
  v_digest text;
  v_seen jsonb := '{}'::jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  p_items := coalesce(p_items, '[]'::jsonb);
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'External references must be an array' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Every external reference must be an object'
        using errcode = '22023';
    end if;
    v_key := v_item->>'reference_key';
    v_preimage := momi_governance.canonicalize_provenance_preimage_v1(
      v_item->'digest_preimage'
    );
    v_digest := momi_governance.provenance_digest_v1(v_preimage);
    if nullif(btrim(v_key), '') is null
      or nullif(btrim(v_item->>'reference_kind'), '') is null
      or nullif(btrim(v_item->>'locator'), '') is null
    then
      raise exception 'Reference key, kind, and locator are required'
        using errcode = '22023';
    end if;
    if nullif(v_item->>'reference_digest', '') is not null
      and (
        v_item->>'reference_digest' !~ '^[0-9a-f]{64}$'
        or v_item->>'reference_digest' <> v_digest
      )
    then
      raise exception 'Reference digest does not match its canonical preimage'
        using errcode = '23514';
    end if;
    if v_seen ? v_key then
      raise exception 'External reference keys must be unique within an event'
        using errcode = '23505';
    end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reference_key', v_key,
      'reference_kind', v_item->>'reference_kind',
      'digest_preimage', v_preimage,
      'reference_digest', v_digest,
      'locator', v_item->>'locator'
    ));
  end loop;
  return v_result;
end;
$$;

create function momi_governance.prepare_material_decision_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.canonical_identity := jsonb_build_object(
    'schema_version', 1,
    'source_kind', new.source_kind,
    'source_decision_id', new.source_decision_id,
    'source_identity_preimage', new.source_identity_preimage,
    'source_identity_digest', new.source_identity_digest,
    'category', new.category
  );
  new.identity_digest := encode(extensions.digest(
    convert_to(new.canonical_identity::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

create function momi_governance.prepare_decision_event_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.canonical_document := jsonb_build_object(
    'schema_version', 1,
    'decision_id', new.decision_id,
    'decision_version', new.decision_version,
    'lifecycle_status', new.lifecycle_status,
    'event_source_kind', new.event_source_kind,
    'event_source_id', new.event_source_id,
    'event_source_preimage', new.event_source_preimage,
    'event_source_digest', new.event_source_digest,
    'caller_idempotency_key', new.caller_idempotency_key,
    'decision', new.decision_text,
    'rationale', new.rationale,
    'alternatives', new.alternatives,
    'consequences', new.consequences,
    'decided_by', new.decided_by,
    'occurred_at', momi_governance.canonical_timestamp_v1(new.occurred_at),
    'source_snapshot', new.source_snapshot,
    'related_decision_id', new.related_decision_id,
    'evidence', new.evidence_manifest,
    'external_references', new.external_reference_manifest
  );
  new.content_digest := encode(extensions.digest(
    convert_to(new.canonical_document::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

create function momi_governance.prepare_decision_evidence_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.canonical_document := jsonb_build_object(
    'schema_version', 1,
    'event_id', new.event_id,
    'decision_id', new.decision_id,
    'evidence_ordinal', new.evidence_ordinal,
    'evidence_key', new.evidence_key,
    'evidence_kind', new.evidence_kind,
    'digest_preimage', new.digest_preimage,
    'evidence_digest', new.evidence_digest,
    'source_snapshot', new.source_snapshot,
    'locator', new.locator,
    'summary', new.summary
  );
  new.content_digest := encode(extensions.digest(
    convert_to(new.canonical_document::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

create function momi_governance.prepare_decision_reference_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.canonical_document := jsonb_build_object(
    'schema_version', 1,
    'event_id', new.event_id,
    'decision_id', new.decision_id,
    'reference_ordinal', new.reference_ordinal,
    'reference_key', new.reference_key,
    'reference_kind', new.reference_kind,
    'digest_preimage', new.digest_preimage,
    'reference_digest', new.reference_digest,
    'locator', new.locator
  );
  new.content_digest := encode(extensions.digest(
    convert_to(new.canonical_document::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

create function momi_governance.prepare_bootstrap_reconciliation_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.mapping_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'schema_version', 1,
    'source_ledger_key', new.source_ledger_key,
    'manifest_digest', new.manifest_digest,
    'entry_count', new.entry_count,
    'decision_mapping', new.decision_mapping,
    'reconciled_by', new.reconciled_by
  )::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

create function momi_governance.reject_ledger_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Project Baseline governance history is append-only'
    using errcode = '55000';
end;
$$;

create trigger material_decisions_prepare
before insert on momi_governance.material_decisions
for each row execute function momi_governance.prepare_material_decision_v1();
create trigger material_decisions_immutable
before update or delete on momi_governance.material_decisions
for each row execute function momi_governance.reject_ledger_mutation();
create trigger material_decisions_no_truncate
before truncate on momi_governance.material_decisions
for each statement execute function momi_governance.reject_ledger_mutation();

create trigger decision_events_prepare
before insert on momi_governance.decision_events
for each row execute function momi_governance.prepare_decision_event_v1();
create trigger decision_events_immutable
before update or delete on momi_governance.decision_events
for each row execute function momi_governance.reject_ledger_mutation();
create trigger decision_events_no_truncate
before truncate on momi_governance.decision_events
for each statement execute function momi_governance.reject_ledger_mutation();

create trigger decision_evidence_prepare
before insert on momi_governance.decision_evidence
for each row execute function momi_governance.prepare_decision_evidence_v1();
create trigger decision_evidence_immutable
before update or delete on momi_governance.decision_evidence
for each row execute function momi_governance.reject_ledger_mutation();
create trigger decision_evidence_no_truncate
before truncate on momi_governance.decision_evidence
for each statement execute function momi_governance.reject_ledger_mutation();

create trigger decision_references_prepare
before insert on momi_governance.decision_external_references
for each row execute function momi_governance.prepare_decision_reference_v1();
create trigger decision_references_immutable
before update or delete on momi_governance.decision_external_references
for each row execute function momi_governance.reject_ledger_mutation();
create trigger decision_references_no_truncate
before truncate on momi_governance.decision_external_references
for each statement execute function momi_governance.reject_ledger_mutation();

create trigger bootstrap_reconciliations_prepare
before insert on momi_governance.bootstrap_reconciliations
for each row execute function momi_governance.prepare_bootstrap_reconciliation_v1();
create trigger bootstrap_reconciliations_immutable
before update or delete on momi_governance.bootstrap_reconciliations
for each row execute function momi_governance.reject_ledger_mutation();
create trigger bootstrap_reconciliations_no_truncate
before truncate on momi_governance.bootstrap_reconciliations
for each statement execute function momi_governance.reject_ledger_mutation();

create function momi_governance.append_decision_event_v1(
  p_source_kind text,
  p_source_decision_id text,
  p_source_identity_digest text,
  p_source_identity_preimage jsonb,
  p_category text,
  p_lifecycle_status text,
  p_event_source_kind text,
  p_event_source_id text,
  p_event_source_digest text,
  p_event_source_preimage jsonb,
  p_caller_idempotency_key text,
  p_decision_text text,
  p_rationale text,
  p_alternatives jsonb,
  p_consequences jsonb,
  p_decided_by text,
  p_occurred_at timestamptz,
  p_source_snapshot text,
  p_related_decision_id uuid default null,
  p_evidence jsonb default '[]'::jsonb,
  p_external_references jsonb default '[]'::jsonb
) returns table (
  decision_id uuid,
  event_id uuid,
  decision_version integer,
  lifecycle_status text,
  content_digest text,
  recorded_at timestamptz,
  inserted boolean
) language plpgsql security invoker set search_path = '' as $$
declare
  v_decision momi_governance.material_decisions%rowtype;
  v_existing_event momi_governance.decision_events%rowtype;
  v_inserted_event momi_governance.decision_events%rowtype;
  v_identity jsonb;
  v_identity_digest text;
  v_source_identity_preimage jsonb;
  v_source_identity_digest text;
  v_event_source_preimage jsonb;
  v_event_source_digest text;
  v_evidence jsonb;
  v_references jsonb;
  v_expected jsonb;
  v_expected_digest text;
  v_last_status text;
  v_last_version integer;
  v_related_status text;
  v_collision_count integer;
  v_item jsonb;
  v_ordinal integer;
  v_lock_decision_id uuid;
begin
  if p_source_kind !~ '^[a-z][a-z0-9_]*$'
    or nullif(btrim(p_source_decision_id), '') is null
    or (
      p_source_identity_digest is not null
      and p_source_identity_digest !~ '^[0-9a-f]{64}$'
    )
    or p_category not in (
      'scope', 'architecture_contract', 'data_security_ops',
      'rollout_production', 'debt_acceptance', 'supersession', 'governance'
    )
    or p_lifecycle_status not in (
      'proposed', 'accepted', 'rejected', 'superseded', 'revoked'
    )
    or p_event_source_kind !~ '^[a-z][a-z0-9_]*$'
    or nullif(btrim(p_event_source_id), '') is null
    or (
      p_event_source_digest is not null
      and p_event_source_digest !~ '^[0-9a-f]{64}$'
    )
    or nullif(btrim(p_caller_idempotency_key), '') is null
    or nullif(btrim(p_decision_text), '') is null
    or nullif(btrim(p_rationale), '') is null
    or nullif(btrim(p_decided_by), '') is null
    or p_occurred_at is null
    or nullif(btrim(p_source_snapshot), '') is null
  then
    raise exception 'Decision identity and event fields are malformed'
      using errcode = '22023';
  end if;

  v_source_identity_preimage :=
    momi_governance.canonicalize_provenance_preimage_v1(
      p_source_identity_preimage
    );
  v_source_identity_digest :=
    momi_governance.provenance_digest_v1(v_source_identity_preimage);
  if p_source_identity_digest is not null
    and p_source_identity_digest <> v_source_identity_digest
  then
    raise exception 'Source identity digest does not match its canonical preimage'
      using errcode = '23514';
  end if;
  v_event_source_preimage :=
    momi_governance.canonicalize_provenance_preimage_v1(
      p_event_source_preimage
    );
  v_event_source_digest :=
    momi_governance.provenance_digest_v1(v_event_source_preimage);
  if p_event_source_digest is not null
    and p_event_source_digest <> v_event_source_digest
  then
    raise exception 'Event source digest does not match its canonical preimage'
      using errcode = '23514';
  end if;
  if (p_lifecycle_status = 'superseded') <> (p_related_decision_id is not null) then
    raise exception 'Only superseded events require a related decision'
      using errcode = '22023';
  end if;

  p_alternatives := coalesce(p_alternatives, '[]'::jsonb);
  p_consequences := coalesce(p_consequences, '[]'::jsonb);
  if jsonb_typeof(p_alternatives) <> 'array'
    or jsonb_typeof(p_consequences) <> 'array'
  then
    raise exception 'Alternatives and consequences must be arrays'
      using errcode = '22023';
  end if;
  v_evidence := momi_governance.canonicalize_evidence_v1(p_evidence);
  v_references :=
    momi_governance.canonicalize_external_references_v1(p_external_references);

  perform pg_advisory_xact_lock(hashtextextended(
    'momi_governance:decision:' || p_source_kind || ':' || p_source_decision_id,
    0
  ));

  v_identity := jsonb_build_object(
    'schema_version', 1,
    'source_kind', p_source_kind,
    'source_decision_id', p_source_decision_id,
    'source_identity_preimage', v_source_identity_preimage,
    'source_identity_digest', v_source_identity_digest,
    'category', p_category
  );
  v_identity_digest := encode(extensions.digest(
    convert_to(v_identity::text, 'UTF8'), 'sha256'), 'hex');

  select stored.* into v_decision
  from momi_governance.material_decisions stored
  where stored.source_kind = p_source_kind
    and stored.source_decision_id = p_source_decision_id;
  if not found then
    if p_lifecycle_status <> 'proposed' then
      raise exception 'A decision must begin with a proposed event'
        using errcode = '23514';
    end if;
    insert into momi_governance.material_decisions (
      source_kind, source_decision_id,
      source_identity_digest, source_identity_preimage, category,
      canonical_identity, identity_digest
    ) values (
      p_source_kind, p_source_decision_id,
      v_source_identity_digest, v_source_identity_preimage, p_category,
      v_identity, v_identity_digest
    ) returning * into v_decision;
  elsif v_decision.identity_digest <> v_identity_digest then
    raise exception 'Decision source identity already has different content'
      using errcode = '23505';
  end if;

  for v_lock_decision_id in
    select candidate.decision_id
    from unnest(array[
      v_decision.decision_id,
      p_related_decision_id
    ]) as candidate(decision_id)
    where candidate.decision_id is not null
    order by candidate.decision_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      'momi_governance:decision-id:' || v_lock_decision_id::text,
      0
    ));
  end loop;

  select coalesce(max(stored.decision_version), 0)
    into v_last_version
  from momi_governance.decision_events stored
  where stored.decision_id = v_decision.decision_id;

  v_expected := jsonb_build_object(
    'schema_version', 1,
    'decision_id', v_decision.decision_id,
    'decision_version', v_last_version + 1,
    'lifecycle_status', p_lifecycle_status,
    'event_source_kind', p_event_source_kind,
    'event_source_id', p_event_source_id,
    'event_source_preimage', v_event_source_preimage,
    'event_source_digest', v_event_source_digest,
    'caller_idempotency_key', p_caller_idempotency_key,
    'decision', p_decision_text,
    'rationale', p_rationale,
    'alternatives', p_alternatives,
    'consequences', p_consequences,
    'decided_by', p_decided_by,
    'occurred_at', momi_governance.canonical_timestamp_v1(p_occurred_at),
    'source_snapshot', p_source_snapshot,
    'related_decision_id', p_related_decision_id,
    'evidence', v_evidence,
    'external_references', v_references
  );
  v_expected_digest := encode(extensions.digest(
    convert_to(v_expected::text, 'UTF8'), 'sha256'), 'hex');

  select count(distinct stored.event_id) into v_collision_count
  from momi_governance.decision_events stored
  where (stored.event_source_kind = p_event_source_kind
      and stored.event_source_id = p_event_source_id)
    or stored.caller_idempotency_key = p_caller_idempotency_key;
  if v_collision_count > 1 then
    raise exception 'Event source identity and idempotency key identify different events'
      using errcode = '23505';
  elsif v_collision_count = 1 then
    select stored.* into v_existing_event
    from momi_governance.decision_events stored
    where (stored.event_source_kind = p_event_source_kind
        and stored.event_source_id = p_event_source_id)
      or stored.caller_idempotency_key = p_caller_idempotency_key
    limit 1;
    if v_existing_event.decision_id <> v_decision.decision_id
      or v_existing_event.event_source_kind <> p_event_source_kind
      or v_existing_event.event_source_id <> p_event_source_id
      or v_existing_event.caller_idempotency_key <> p_caller_idempotency_key
      or v_existing_event.content_digest <> encode(extensions.digest(
        convert_to(jsonb_set(
          v_expected,
          '{decision_version}',
          to_jsonb(v_existing_event.decision_version)
        )::text, 'UTF8'), 'sha256'), 'hex')
    then
      raise exception 'Event replay changed content or identity'
        using errcode = '23505';
    end if;
    return query select
      v_existing_event.decision_id,
      v_existing_event.event_id,
      v_existing_event.decision_version,
      v_existing_event.lifecycle_status,
      v_existing_event.content_digest,
      v_existing_event.recorded_at,
      false;
    return;
  end if;

  select stored.lifecycle_status into v_last_status
  from momi_governance.decision_events stored
  where stored.decision_id = v_decision.decision_id
  order by stored.decision_version desc
  limit 1;

  if v_last_version = 0 and p_lifecycle_status <> 'proposed' then
    raise exception 'A decision must begin with a proposed event'
      using errcode = '23514';
  elsif v_last_version > 0 and not (
    (v_last_status = 'proposed' and p_lifecycle_status in ('accepted', 'rejected'))
    or
    (v_last_status = 'accepted' and p_lifecycle_status in ('superseded', 'revoked'))
  ) then
    raise exception 'Illegal material-decision lifecycle transition: % to %',
      v_last_status, p_lifecycle_status using errcode = '23514';
  end if;

  if p_lifecycle_status = 'superseded' then
    select stored.lifecycle_status into v_related_status
    from momi_governance.decision_events stored
    where stored.decision_id = p_related_decision_id
    order by stored.decision_version desc
    limit 1;
    if v_related_status is distinct from 'accepted' then
      raise exception 'A superseding decision must currently be accepted'
        using errcode = '23514';
    end if;
  end if;

  insert into momi_governance.decision_events (
    decision_id, decision_version, lifecycle_status,
    event_source_kind, event_source_id,
    event_source_digest, event_source_preimage,
    caller_idempotency_key, decision_text, rationale,
    alternatives, consequences, decided_by, occurred_at, source_snapshot,
    related_decision_id, evidence_manifest, external_reference_manifest,
    canonical_document, content_digest
  ) values (
    v_decision.decision_id, v_last_version + 1, p_lifecycle_status,
    p_event_source_kind, p_event_source_id,
    v_event_source_digest, v_event_source_preimage,
    p_caller_idempotency_key, p_decision_text, p_rationale,
    p_alternatives, p_consequences, p_decided_by, p_occurred_at,
    p_source_snapshot, p_related_decision_id, v_evidence, v_references,
    v_expected, v_expected_digest
  ) returning * into v_inserted_event;

  for v_item, v_ordinal in
    select value, ordinality::integer
    from jsonb_array_elements(v_evidence) with ordinality
  loop
    insert into momi_governance.decision_evidence (
      event_id, decision_id, evidence_ordinal,
      evidence_key, evidence_kind, evidence_digest,
      digest_preimage,
      source_snapshot, locator, summary,
      canonical_document, content_digest
    ) values (
      v_inserted_event.event_id, v_decision.decision_id, v_ordinal,
      v_item->>'evidence_key', v_item->>'evidence_kind',
      v_item->>'evidence_digest', v_item->'digest_preimage',
      v_item->>'source_snapshot',
      v_item->>'locator', v_item->>'summary',
      '{}'::jsonb, repeat('0', 64)
    );
  end loop;

  for v_item, v_ordinal in
    select value, ordinality::integer
    from jsonb_array_elements(v_references) with ordinality
  loop
    insert into momi_governance.decision_external_references (
      event_id, decision_id, reference_ordinal,
      reference_key, reference_kind, reference_digest, locator,
      digest_preimage,
      canonical_document, content_digest
    ) values (
      v_inserted_event.event_id, v_decision.decision_id, v_ordinal,
      v_item->>'reference_key', v_item->>'reference_kind',
      v_item->>'reference_digest', v_item->>'locator',
      v_item->'digest_preimage',
      '{}'::jsonb, repeat('0', 64)
    );
  end loop;

  return query select
    v_inserted_event.decision_id,
    v_inserted_event.event_id,
    v_inserted_event.decision_version,
    v_inserted_event.lifecycle_status,
    v_inserted_event.content_digest,
    v_inserted_event.recorded_at,
    true;
end;
$$;

create function momi_governance.read_decision_history_v1(p_decision_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_decision momi_governance.material_decisions%rowtype;
  v_current momi_governance.decision_events%rowtype;
  v_history jsonb;
begin
  select stored.* into v_decision
  from momi_governance.material_decisions stored
  where stored.decision_id = p_decision_id;
  if not found then
    raise exception 'Material decision does not exist' using errcode = '02000';
  end if;

  select stored.* into v_current
  from momi_governance.decision_events stored
  where stored.decision_id = p_decision_id
  order by stored.decision_version desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event_row.event_id,
    'decision_version', event_row.decision_version,
    'lifecycle_status', event_row.lifecycle_status,
    'canonical_document', event_row.canonical_document,
    'content_digest', event_row.content_digest,
    'recorded_at', momi_governance.canonical_timestamp_v1(event_row.recorded_at),
    'evidence', (
      select coalesce(jsonb_agg(evidence_row.canonical_document
        order by evidence_row.evidence_ordinal), '[]'::jsonb)
      from momi_governance.decision_evidence evidence_row
      where evidence_row.event_id = event_row.event_id
    ),
    'external_references', (
      select coalesce(jsonb_agg(reference_row.canonical_document
        order by reference_row.reference_ordinal), '[]'::jsonb)
      from momi_governance.decision_external_references reference_row
      where reference_row.event_id = event_row.event_id
    )
  ) order by event_row.decision_version), '[]'::jsonb)
  into v_history
  from momi_governance.decision_events event_row
  where event_row.decision_id = p_decision_id;

  return jsonb_build_object(
    'schema_version', 1,
    'decision_id', v_decision.decision_id,
    'identity', v_decision.canonical_identity,
    'identity_digest', v_decision.identity_digest,
    'current_projection', case when v_current.event_id is null then null
      else jsonb_build_object(
        'event_id', v_current.event_id,
        'decision_version', v_current.decision_version,
        'lifecycle_status', v_current.lifecycle_status,
        'canonical_document', v_current.canonical_document,
        'content_digest', v_current.content_digest
      )
    end,
    'history', v_history
  );
end;
$$;

create function momi_governance.canonicalize_bootstrap_entry_v1(p_entry jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_alternatives jsonb;
  v_consequences jsonb;
  v_decided_at timestamptz;
  v_evidence jsonb;
  v_references jsonb;
begin
  if p_entry is null
    or jsonb_typeof(p_entry) <> 'object'
    or p_entry->>'schema_version' <> '1'
    or (
      p_entry
      - 'schema_version' - 'temporary_id' - 'category' - 'decision'
      - 'rationale' - 'alternatives' - 'consequences' - 'decided_by'
      - 'decided_at' - 'source_snapshot' - 'supersedes_temporary_id'
      - 'evidence' - 'external_references' - 'temporary_digest'
    ) <> '{}'::jsonb
    or nullif(btrim(p_entry->>'temporary_id'), '') is null
    or p_entry->>'category' not in (
      'scope', 'architecture_contract', 'data_security_ops',
      'rollout_production', 'debt_acceptance', 'supersession', 'governance'
    )
    or nullif(btrim(p_entry->>'decision'), '') is null
    or nullif(btrim(p_entry->>'rationale'), '') is null
    or nullif(btrim(p_entry->>'decided_by'), '') is null
    or nullif(btrim(p_entry->>'decided_at'), '') is null
    or nullif(btrim(p_entry->>'source_snapshot'), '') is null
  then
    raise exception 'Bootstrap decision fields are malformed'
      using errcode = '22023';
  end if;

  v_alternatives := coalesce(p_entry->'alternatives', '[]'::jsonb);
  v_consequences := coalesce(p_entry->'consequences', '[]'::jsonb);
  if jsonb_typeof(v_alternatives) <> 'array'
    or jsonb_typeof(v_consequences) <> 'array'
  then
    raise exception 'Bootstrap alternatives and consequences must be arrays'
      using errcode = '22023';
  end if;
  v_decided_at := (p_entry->>'decided_at')::timestamptz;
  v_evidence := momi_governance.canonicalize_evidence_v1(p_entry->'evidence');
  v_references := momi_governance.canonicalize_external_references_v1(
    p_entry->'external_references'
  );

  return jsonb_build_object(
    'schema_version', 1,
    'temporary_id', p_entry->>'temporary_id',
    'category', p_entry->>'category',
    'decision', p_entry->>'decision',
    'rationale', p_entry->>'rationale',
    'alternatives', v_alternatives,
    'consequences', v_consequences,
    'decided_by', p_entry->>'decided_by',
    'decided_at', momi_governance.canonical_timestamp_v1(v_decided_at),
    'source_snapshot', p_entry->>'source_snapshot',
    'supersedes_temporary_id', nullif(
      p_entry->>'supersedes_temporary_id', ''
    ),
    'evidence', v_evidence,
    'external_references', v_references
  );
end;
$$;

create function momi_governance.reconcile_bootstrap_v1(
  p_source_ledger_key text,
  p_expected_manifest_digest text,
  p_entries jsonb,
  p_reconciled_by text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_existing momi_governance.bootstrap_reconciliations%rowtype;
  v_entry jsonb;
  v_entry_canonical jsonb;
  v_manifest_entries jsonb := '[]'::jsonb;
  v_computed_manifest_digest text;
  v_entry_digest text;
  v_seen jsonb := '{}'::jsonb;
  v_mapping jsonb := '{}'::jsonb;
  v_proposed record;
  v_accepted record;
  v_superseded record;
  v_target_decision momi_governance.material_decisions%rowtype;
  v_supersedes uuid;
  v_source_identity_preimage jsonb;
  v_event_source_preimage jsonb;
  v_count integer := 0;
  v_inserted integer := 0;
begin
  if p_source_ledger_key <> 'project-baseline-pre-ledger-v1'
    or nullif(btrim(p_reconciled_by), '') is null
    or p_expected_manifest_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_entries) <> 'array'
    or jsonb_array_length(p_entries) = 0
  then
    raise exception 'The fixed bootstrap identity, actor, digest, and entries are required'
      using errcode = '22023';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(v_entry) <> 'object'
      or nullif(btrim(v_entry->>'temporary_id'), '') is null
      or coalesce(v_entry->>'temporary_digest', '') !~ '^[0-9a-f]{64}$'
    then
      raise exception 'Bootstrap temporary ID and SHA-256 digest are required'
        using errcode = '22023';
    end if;
    if v_seen ? (v_entry->>'temporary_id') then
      raise exception 'Bootstrap temporary decision IDs must be unique'
        using errcode = '23505';
    end if;
    v_seen := v_seen || jsonb_build_object(v_entry->>'temporary_id', true);

    v_entry_canonical :=
      momi_governance.canonicalize_bootstrap_entry_v1(v_entry);
    v_entry_digest := encode(extensions.digest(
      convert_to(v_entry_canonical::text, 'UTF8'), 'sha256'), 'hex');
    if v_entry_digest <> v_entry->>'temporary_digest' then
      raise exception 'Bootstrap temporary digest does not match canonical entry %',
        v_entry->>'temporary_id' using errcode = '23514';
    end if;
    v_manifest_entries := v_manifest_entries || jsonb_build_array(
      v_entry_canonical || jsonb_build_object(
        'temporary_digest', v_entry_digest
      )
    );
  end loop;

  v_computed_manifest_digest := encode(extensions.digest(convert_to(
    jsonb_build_object(
      'schema_version', 1,
      'entries', v_manifest_entries
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');
  if v_computed_manifest_digest <> p_expected_manifest_digest then
    raise exception 'Bootstrap manifest digest does not match canonical entries'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'momi_governance:bootstrap:' || p_source_ledger_key,
    0
  ));
  select stored.* into v_existing
  from momi_governance.bootstrap_reconciliations stored
  where stored.source_ledger_key = p_source_ledger_key;
  if found then
    if v_existing.manifest_digest <> v_computed_manifest_digest then
      raise exception 'Bootstrap ledger already reconciled with another digest'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'replayed', true,
      'computed_manifest_digest', v_computed_manifest_digest,
      'mapping', v_existing.decision_mapping,
      'mapping_digest', v_existing.mapping_digest
    );
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    v_entry_canonical :=
      momi_governance.canonicalize_bootstrap_entry_v1(v_entry);
    v_source_identity_preimage := jsonb_build_object(
      'schema_version', 1,
      'encoding', 'utf-8',
      'content', jsonb_build_object(
        'source_ledger_key', p_source_ledger_key,
        'temporary_id', v_entry_canonical->>'temporary_id'
      )::text
    );
    v_supersedes := null;
    if v_entry_canonical->>'supersedes_temporary_id' is not null then
      v_supersedes := (
        v_mapping #>> array[
          v_entry_canonical->>'supersedes_temporary_id',
          'decision_id'
        ]
      )::uuid;
      if v_supersedes is null then
        raise exception 'Superseded temporary decision must appear first'
          using errcode = '23503';
      end if;
    end if;

    v_event_source_preimage := jsonb_build_object(
      'schema_version', 1,
      'encoding', 'utf-8',
      'content', jsonb_build_object(
        'lifecycle_status', 'proposed',
        'source_ledger_key', p_source_ledger_key,
        'temporary_id', v_entry_canonical->>'temporary_id'
      )::text
    );
    select * into v_proposed
    from momi_governance.append_decision_event_v1(
      p_source_kind => 'linear_bootstrap',
      p_source_decision_id => v_entry_canonical->>'temporary_id',
      p_source_identity_digest =>
        momi_governance.provenance_digest_v1(v_source_identity_preimage),
      p_source_identity_preimage => v_source_identity_preimage,
      p_category => v_entry_canonical->>'category',
      p_lifecycle_status => 'proposed',
      p_event_source_kind => 'linear_bootstrap',
      p_event_source_id =>
        (v_entry_canonical->>'temporary_id') || ':proposed',
      p_event_source_digest =>
        momi_governance.provenance_digest_v1(v_event_source_preimage),
      p_event_source_preimage => v_event_source_preimage,
      p_caller_idempotency_key =>
        p_source_ledger_key || ':'
          || (v_entry_canonical->>'temporary_id') || ':proposed',
      p_decision_text => v_entry_canonical->>'decision',
      p_rationale => v_entry_canonical->>'rationale',
      p_alternatives => v_entry_canonical->'alternatives',
      p_consequences => v_entry_canonical->'consequences',
      p_decided_by => v_entry_canonical->>'decided_by',
      p_occurred_at => (v_entry_canonical->>'decided_at')::timestamptz,
      p_source_snapshot => v_entry_canonical->>'source_snapshot',
      p_related_decision_id => null,
      p_evidence => v_entry_canonical->'evidence',
      p_external_references => v_entry_canonical->'external_references'
    );

    v_event_source_preimage := jsonb_build_object(
      'schema_version', 1,
      'encoding', 'utf-8',
      'content', jsonb_build_object(
        'lifecycle_status', 'accepted',
        'source_ledger_key', p_source_ledger_key,
        'temporary_id', v_entry_canonical->>'temporary_id'
      )::text
    );
    select * into v_accepted
    from momi_governance.append_decision_event_v1(
      p_source_kind => 'linear_bootstrap',
      p_source_decision_id => v_entry_canonical->>'temporary_id',
      p_source_identity_digest =>
        momi_governance.provenance_digest_v1(v_source_identity_preimage),
      p_source_identity_preimage => v_source_identity_preimage,
      p_category => v_entry_canonical->>'category',
      p_lifecycle_status => 'accepted',
      p_event_source_kind => 'linear_bootstrap',
      p_event_source_id =>
        (v_entry_canonical->>'temporary_id') || ':accepted',
      p_event_source_digest =>
        momi_governance.provenance_digest_v1(v_event_source_preimage),
      p_event_source_preimage => v_event_source_preimage,
      p_caller_idempotency_key =>
        p_source_ledger_key || ':'
          || (v_entry_canonical->>'temporary_id') || ':accepted',
      p_decision_text => v_entry_canonical->>'decision',
      p_rationale => v_entry_canonical->>'rationale',
      p_alternatives => v_entry_canonical->'alternatives',
      p_consequences => v_entry_canonical->'consequences',
      p_decided_by => v_entry_canonical->>'decided_by',
      p_occurred_at => (v_entry_canonical->>'decided_at')::timestamptz,
      p_source_snapshot => v_entry_canonical->>'source_snapshot',
      p_related_decision_id => null,
      p_evidence => '[]'::jsonb,
      p_external_references => '[]'::jsonb
    );

    v_mapping := v_mapping || jsonb_build_object(
      v_entry_canonical->>'temporary_id',
      jsonb_build_object(
        'decision_id', v_accepted.decision_id,
        'proposed_event_id', v_proposed.event_id,
        'accepted_event_id', v_accepted.event_id,
        'accepted_content_digest', v_accepted.content_digest,
        'temporary_digest', v_entry->>'temporary_digest'
      )
    );

    if v_supersedes is not null then
      select stored.* into v_target_decision
      from momi_governance.material_decisions stored
      where stored.decision_id = v_supersedes;
      v_event_source_preimage := jsonb_build_object(
        'schema_version', 1,
        'encoding', 'utf-8',
        'content', jsonb_build_object(
          'lifecycle_status', 'superseded',
          'source_ledger_key', p_source_ledger_key,
          'superseded_temporary_id',
            v_entry_canonical->>'supersedes_temporary_id',
          'superseding_temporary_id', v_entry_canonical->>'temporary_id'
        )::text
      );
      select * into v_superseded
      from momi_governance.append_decision_event_v1(
        p_source_kind => v_target_decision.source_kind,
        p_source_decision_id => v_target_decision.source_decision_id,
        p_source_identity_digest => v_target_decision.source_identity_digest,
        p_source_identity_preimage => v_target_decision.source_identity_preimage,
        p_category => v_target_decision.category,
        p_lifecycle_status => 'superseded',
        p_event_source_kind => 'linear_bootstrap',
        p_event_source_id => (v_entry_canonical->>'temporary_id')
          || ':supersedes:'
          || (v_entry_canonical->>'supersedes_temporary_id'),
        p_event_source_digest =>
          momi_governance.provenance_digest_v1(v_event_source_preimage),
        p_event_source_preimage => v_event_source_preimage,
        p_caller_idempotency_key =>
          p_source_ledger_key || ':' || (v_entry_canonical->>'temporary_id')
            || ':supersedes:'
            || (v_entry_canonical->>'supersedes_temporary_id'),
        p_decision_text =>
          'Superseded by bootstrap decision '
            || (v_entry_canonical->>'temporary_id'),
        p_rationale => v_entry_canonical->>'rationale',
        p_alternatives => '[]'::jsonb,
        p_consequences => '[]'::jsonb,
        p_decided_by => v_entry_canonical->>'decided_by',
        p_occurred_at => (v_entry_canonical->>'decided_at')::timestamptz,
        p_source_snapshot => v_entry_canonical->>'source_snapshot',
        p_related_decision_id => v_accepted.decision_id,
        p_evidence => '[]'::jsonb,
        p_external_references => '[]'::jsonb
      );
    end if;

    v_count := v_count + 1;
    if v_proposed.inserted then v_inserted := v_inserted + 1; end if;
    if v_accepted.inserted then v_inserted := v_inserted + 1; end if;
    if v_supersedes is not null then
      if v_superseded.inserted then v_inserted := v_inserted + 1; end if;
    end if;
  end loop;

  insert into momi_governance.bootstrap_reconciliations (
    singleton, source_ledger_key, manifest_digest, entry_count,
    decision_mapping, mapping_digest, reconciled_by
  ) values (
    true, p_source_ledger_key, v_computed_manifest_digest, v_count,
    v_mapping, repeat('0', 64), p_reconciled_by
  );
  select stored.* into v_existing
  from momi_governance.bootstrap_reconciliations stored
  where stored.source_ledger_key = p_source_ledger_key;
  return jsonb_build_object(
    'replayed', false,
    'inserted_event_count', v_inserted,
    'computed_manifest_digest', v_computed_manifest_digest,
    'mapping', v_mapping,
    'mapping_digest', v_existing.mapping_digest
  );
end;
$$;

revoke all on all tables in schema momi_governance
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema momi_governance
  from public, anon, authenticated, service_role;
revoke all on all functions in schema momi_governance
  from public, anon, authenticated, service_role;

comment on schema momi_governance is
  'Private append-only material decision history for Project Baseline governance.';
comment on function momi_governance.append_decision_event_v1 is
  'Append or exactly replay one legal material-decision lifecycle event.';
comment on function momi_governance.canonicalize_provenance_preimage_v1 is
  'Validate the sole provenance preimage shape: version 1 UTF-8 string content.';
comment on function momi_governance.provenance_digest_v1 is
  'Compute SHA-256 over the exact UTF-8 content bytes in a provenance preimage.';
comment on function momi_governance.canonicalize_bootstrap_entry_v1 is
  'Return the exact canonical bootstrap entry used for entry and manifest digests.';
comment on function momi_governance.read_decision_history_v1 is
  'Read one versioned decision history and its current lifecycle projection.';
comment on function momi_governance.reconcile_bootstrap_v1 is
  'Validate and reconcile one canonical temporary ledger exactly once.';
comment on table momi_governance.decision_evidence is
  'Append-only evidence records bound to immutable decision events.';
comment on table momi_governance.decision_external_references is
  'Append-only external references bound to immutable decision events.';
