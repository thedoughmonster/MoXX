do $$
declare
  v_entries jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_manifest text;
  v_result jsonb;
  v_replay jsonb;
  v_source_snapshot text :=
    'Canonical digest-input bytes documented in '
    || 'docs/project-baseline-bootstrap-manifest.md; snapshot 2026-08-17 UTC';
begin
  v_entry := jsonb_build_object(
    'schema_version', 1,
    'temporary_id', 'TMP-PB-20260817-001',
    'category', 'scope',
    'decision', 'Authorize Project Baseline through the Remediation Ready gate',
    'rationale',
      'The owner authorized one governed mission to establish the freeze, audit every '
      || 'named surface, independently verify and deduplicate findings, and produce '
      || 'decision-complete remediation work without starting remediation.',
    'alternatives', '[]'::jsonb,
    'consequences', jsonb_build_array(
      'The mission ends at Remediation Ready and does not unfreeze work.',
      'Every audit surface must be completed or have a precise access blocker.'
    ),
    'decided_by', 'Project Baseline owner',
    'decided_at', momi_governance.canonical_timestamp_v1(
      '2026-08-17T00:00:00Z'
    ),
    'source_snapshot', v_source_snapshot,
    'supersedes_temporary_id', null,
    'evidence', jsonb_build_array(jsonb_build_object(
      'evidence_key', 'owner-instruction-PB-BOOT-001',
      'evidence_kind', 'operator_instruction',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content',
        'Bring Mission: Project Baseline to the Remediation Ready gate: '
          || 'establish the Linear project and portfolio freeze, build and use '
          || 'the Supabase decision ledger, exhaustively audit the Mo-XX '
          || 'codebase, stack, runtime, integrations, databases, GitHub, and '
          || 'project boards, independently validate and deduplicate findings, '
          || 'and produce decision-complete remediation issues in Linear.'
      ),
      'source_snapshot', v_source_snapshot,
      'locator', 'repo:docs/project-baseline-bootstrap-manifest.md#PB-BOOT-001',
      'summary', 'Exact UTF-8 source bytes are documented under PB-BOOT-001.'
    )),
    'external_references', jsonb_build_array(
      jsonb_build_object(
        'reference_key', 'project-baseline-project',
        'reference_kind', 'linear_project',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:project:Project Baseline'
        ),
        'locator', 'linear:project:Project Baseline'
      ),
      jsonb_build_object(
        'reference_key', 'delivery-initiative',
        'reference_kind', 'linear_initiative',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:initiative:Mo-XX Product and Platform Delivery'
        ),
        'locator', 'linear:initiative:Mo-XX Product and Platform Delivery'
      ),
      jsonb_build_object(
        'reference_key', 'remediation-ready-exit',
        'reference_kind', 'linear_issue',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:issue:MOX-176'
        ),
        'locator', 'linear:issue:MOX-176'
      )
    )
  );
  v_entry := momi_governance.canonicalize_bootstrap_entry_v1(v_entry);
  v_entry := v_entry || jsonb_build_object(
    'temporary_digest', encode(extensions.digest(
      convert_to(v_entry::text, 'UTF8'), 'sha256'
    ), 'hex')
  );
  v_entries := v_entries || jsonb_build_array(v_entry);

  v_entry := jsonb_build_object(
    'schema_version', 1,
    'temporary_id', 'TMP-PB-20260817-002',
    'category', 'governance',
    'decision',
      'Freeze non-baseline execution while preserving deterministic restoration evidence',
    'rationale',
      'A portfolio halt prevents concurrent work from invalidating the baseline while '
      || 'preserving enough additive evidence for deterministic restoration.',
    'alternatives', '[]'::jsonb,
    'consequences', jsonb_build_array(
      'Decision state is accepted; enforcement remains approval and capability gated.',
      'Current project states are preserved where Linear offers no Paused state.',
      'Restoration evidence contains public identifiers and aggregate facts only.'
    ),
    'decided_by', 'Project Baseline owner',
    'decided_at', momi_governance.canonical_timestamp_v1(
      '2026-08-17T00:00:00Z'
    ),
    'source_snapshot', v_source_snapshot,
    'supersedes_temporary_id', null,
    'evidence', jsonb_build_array(jsonb_build_object(
      'evidence_key', 'owner-instruction-PB-BOOT-002',
      'evidence_kind', 'operator_instruction',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content',
        'pause existing Linear projects while preserving exact restoration '
          || 'manifest.'
      ),
      'source_snapshot', v_source_snapshot,
      'locator', 'repo:docs/project-baseline-bootstrap-manifest.md#PB-BOOT-002',
      'summary', 'Exact UTF-8 source bytes are documented under PB-BOOT-002.'
    )),
    'external_references', jsonb_build_array(
      jsonb_build_object(
        'reference_key', 'project-baseline-project',
        'reference_kind', 'linear_project',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:project:Project Baseline'
        ),
        'locator', 'linear:project:Project Baseline'
      ),
      jsonb_build_object(
        'reference_key', 'freeze-gate',
        'reference_kind', 'linear_issue',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:issue:MOX-167'
        ),
        'locator', 'linear:issue:MOX-167'
      )
    )
  );
  v_entry := momi_governance.canonicalize_bootstrap_entry_v1(v_entry);
  v_entry := v_entry || jsonb_build_object(
    'temporary_digest', encode(extensions.digest(
      convert_to(v_entry::text, 'UTF8'), 'sha256'
    ), 'hex')
  );
  v_entries := v_entries || jsonb_build_array(v_entry);

  v_entry := jsonb_build_object(
    'schema_version', 1,
    'temporary_id', 'TMP-PB-20260817-003',
    'category', 'governance',
    'decision',
      'Apply Project Baseline scope to the complete pre-existing cohort and native '
      || 'baseline blocking controls to unfinished non-baseline work; preserve '
      || 'terminal history as scope-only',
    'rationale',
      'The complete cohort must remain census-visible while only unfinished work is '
      || 'represented as blocked by the baseline freeze.',
    'alternatives', '[]'::jsonb,
    'consequences', jsonb_build_array(
      'All pre-existing issues receive mission scope.',
      'Only unfinished non-baseline issues receive the blocked label and native edge.',
      'Terminal issues retain history and never receive a false blocking relation.',
      'Decision state is accepted; enforcement remains approval and capability gated.'
    ),
    'decided_by', 'Project Baseline owner',
    'decided_at', momi_governance.canonical_timestamp_v1(
      '2026-08-17T00:00:00Z'
    ),
    'source_snapshot', v_source_snapshot,
    'supersedes_temporary_id', null,
    'evidence', jsonb_build_array(jsonb_build_object(
      'evidence_key', 'owner-instruction-PB-BOOT-003',
      'evidence_kind', 'operator_instruction',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content',
        'apply mission:project-baseline to all existing issues and '
          || 'blocked:project-baseline plus native blockedBy relation to every '
          || E'unfinished non-baseline issue;\nTerminal history gets only '
          || 'scope label, not false blocker relation.'
      ),
      'source_snapshot', v_source_snapshot,
      'locator', 'repo:docs/project-baseline-bootstrap-manifest.md#PB-BOOT-003',
      'summary', 'Exact UTF-8 source bytes are documented under PB-BOOT-003.'
    )),
    'external_references', jsonb_build_array(
      jsonb_build_object(
        'reference_key', 'project-baseline-project',
        'reference_kind', 'linear_project',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:project:Project Baseline'
        ),
        'locator', 'linear:project:Project Baseline'
      ),
      jsonb_build_object(
        'reference_key', 'freeze-gate',
        'reference_kind', 'linear_issue',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:issue:MOX-167'
        ),
        'locator', 'linear:issue:MOX-167'
      )
    )
  );
  v_entry := momi_governance.canonicalize_bootstrap_entry_v1(v_entry);
  v_entry := v_entry || jsonb_build_object(
    'temporary_digest', encode(extensions.digest(
      convert_to(v_entry::text, 'UTF8'), 'sha256'
    ), 'hex')
  );
  v_entries := v_entries || jsonb_build_array(v_entry);

  v_entry := jsonb_build_object(
    'schema_version', 1,
    'temporary_id', 'TMP-PB-20260817-004',
    'category', 'governance',
    'decision',
      'Use Supabase as the immutable material-decision ledger and Linear as '
      || 'executable authority',
    'rationale',
      'Executable scope, status, dependencies, and acceptance need one operational '
      || 'authority while immutable material-decision history needs a separate '
      || 'append-only authority.',
    'alternatives', '[]'::jsonb,
    'consequences', jsonb_build_array(
      'Linear owns executable scope, status, dependencies, and acceptance.',
      'Supabase owns immutable material-decision history.',
      'Only material decisions enter the permanent ledger.'
    ),
    'decided_by', 'Project Baseline owner',
    'decided_at', momi_governance.canonical_timestamp_v1(
      '2026-08-17T00:00:00Z'
    ),
    'source_snapshot', v_source_snapshot,
    'supersedes_temporary_id', null,
    'evidence', jsonb_build_array(jsonb_build_object(
      'evidence_key', 'owner-instruction-PB-BOOT-004',
      'evidence_kind', 'operator_instruction',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content',
        'Canonical authority: Linear owns executable scope/status/dependencies/'
          || 'acceptance. Supabase owns immutable material decision history.'
      ),
      'source_snapshot', v_source_snapshot,
      'locator', 'repo:docs/project-baseline-bootstrap-manifest.md#PB-BOOT-004',
      'summary', 'Exact UTF-8 source bytes are documented under PB-BOOT-004.'
    )),
    'external_references', jsonb_build_array(
      jsonb_build_object(
        'reference_key', 'project-baseline-project',
        'reference_kind', 'linear_project',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:project:Project Baseline'
        ),
        'locator', 'linear:project:Project Baseline'
      ),
      jsonb_build_object(
        'reference_key', 'decision-ledger-issue',
        'reference_kind', 'linear_issue',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:issue:MOX-168'
        ),
        'locator', 'linear:issue:MOX-168'
      )
    )
  );
  v_entry := momi_governance.canonicalize_bootstrap_entry_v1(v_entry);
  v_entry := v_entry || jsonb_build_object(
    'temporary_digest', encode(extensions.digest(
      convert_to(v_entry::text, 'UTF8'), 'sha256'
    ), 'hex')
  );
  v_entries := v_entries || jsonb_build_array(v_entry);

  v_entry := jsonb_build_object(
    'schema_version', 1,
    'temporary_id', 'TMP-PB-20260817-005',
    'category', 'governance',
    'decision',
      'Use a fresh checkpointed coordinator with context-minimized '
      || 'unforked/delegated workers as capacity permits, preserving overnight '
      || 'continuity',
    'rationale',
      'A durable checkpoint and concise worker summaries preserve audit continuity '
      || 'without transferring stale conversational context.',
    'alternatives', '[]'::jsonb,
    'consequences', jsonb_build_array(
      'Coordinator checkpoints preserve queue, completed work, active work, '
      || 'findings, decisions, constraints, and exact next actions.',
      'Workers receive bounded context-minimized scopes and return structured evidence.',
      'Worker count follows available capacity rather than a ledgered fixed cap.'
    ),
    'decided_by', 'Project Baseline owner',
    'decided_at', momi_governance.canonical_timestamp_v1(
      '2026-08-17T00:00:00Z'
    ),
    'source_snapshot', v_source_snapshot,
    'supersedes_temporary_id', null,
    'evidence', jsonb_build_array(jsonb_build_object(
      'evidence_key', 'owner-instruction-PB-BOOT-005',
      'evidence_kind', 'operator_instruction',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content',
        'You are the fresh unforked overnight coordinator for Mission: '
          || E'Project Baseline.\nContinuity: create a durable Linear '
          || 'Coordinator Checkpoint and update after every worker wave with '
          || 'queue/completed/active work, accepted/disputed findings, decision '
          || 'IDs, constraints, and exact next actions. Consume summaries, not '
          || 'raw transcripts.'
      ),
      'source_snapshot', v_source_snapshot,
      'locator', 'repo:docs/project-baseline-bootstrap-manifest.md#PB-BOOT-005',
      'summary',
        'Exact owner continuity bytes are documented under PB-BOOT-005; '
        || 'the decision title is a coordinator-approved restatement.'
    )),
    'external_references', jsonb_build_array(jsonb_build_object(
      'reference_key', 'project-baseline-project',
      'reference_kind', 'linear_project',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8',
        'content', 'linear:project:Project Baseline'
      ),
      'locator', 'linear:project:Project Baseline'
    ))
  );
  v_entry := momi_governance.canonicalize_bootstrap_entry_v1(v_entry);
  v_entry := v_entry || jsonb_build_object(
    'temporary_digest', encode(extensions.digest(
      convert_to(v_entry::text, 'UTF8'), 'sha256'
    ), 'hex')
  );
  v_entries := v_entries || jsonb_build_array(v_entry);

  v_entry := jsonb_build_object(
    'schema_version', 1,
    'temporary_id', 'TMP-PB-20260817-006',
    'category', 'scope',
    'decision',
      'Enforce read-only surfaces except allowlisted Linear governance and '
      || 'decision-ledger implementation/use, with no production or non-ledger '
      || 'remediation',
    'rationale',
      'The baseline must observe production and operational truth without changing '
      || 'the systems being measured or implicitly authorizing remediation.',
    'alternatives', '[]'::jsonb,
    'consequences', jsonb_build_array(
      'Production, runtime, providers, and non-ledger repositories remain read-only.',
      'Only allowlisted Linear governance and ledger implementation/use may mutate.',
      'Production promotion and non-ledger remediation require separate owner approval.'
    ),
    'decided_by', 'Project Baseline owner',
    'decided_at', momi_governance.canonical_timestamp_v1(
      '2026-08-17T00:00:00Z'
    ),
    'source_snapshot', v_source_snapshot,
    'supersedes_temporary_id', null,
    'evidence', jsonb_build_array(jsonb_build_object(
      'evidence_key', 'owner-instruction-PB-BOOT-006',
      'evidence_kind', 'operator_instruction',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content',
        'All surfaces are read-only except allowlisted Linear governance and '
          || 'decision-ledger implementation/use. Do not alter production or '
          || 'begin non-ledger remediation.'
      ),
      'source_snapshot', v_source_snapshot,
      'locator', 'repo:docs/project-baseline-bootstrap-manifest.md#PB-BOOT-006',
      'summary', 'Exact UTF-8 source bytes are documented under PB-BOOT-006.'
    )),
    'external_references', jsonb_build_array(
      jsonb_build_object(
        'reference_key', 'project-baseline-project',
        'reference_kind', 'linear_project',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:project:Project Baseline'
        ),
        'locator', 'linear:project:Project Baseline'
      ),
      jsonb_build_object(
        'reference_key', 'freeze-gate',
        'reference_kind', 'linear_issue',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:issue:MOX-167'
        ),
        'locator', 'linear:issue:MOX-167'
      ),
      jsonb_build_object(
        'reference_key', 'decision-ledger-issue',
        'reference_kind', 'linear_issue',
        'digest_preimage', jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', 'linear:issue:MOX-168'
        ),
        'locator', 'linear:issue:MOX-168'
      )
    )
  );
  v_entry := momi_governance.canonicalize_bootstrap_entry_v1(v_entry);
  v_entry := v_entry || jsonb_build_object(
    'temporary_digest', encode(extensions.digest(
      convert_to(v_entry::text, 'UTF8'), 'sha256'
    ), 'hex')
  );
  v_entries := v_entries || jsonb_build_array(v_entry);

  v_manifest := encode(extensions.digest(convert_to(jsonb_build_object(
    'schema_version', 1,
    'entries', v_entries
  )::text, 'UTF8'), 'sha256'), 'hex');
  if v_manifest <> 'd89d4c426419976631b1e411f516eea915176a6e20690d8944e7600487da8b2a' then
    raise exception 'Canonical bootstrap manifest changed unexpectedly: %', v_manifest;
  end if;

  v_result := momi_governance.reconcile_bootstrap_v1(
    'project-baseline-pre-ledger-v1',
    'd89d4c426419976631b1e411f516eea915176a6e20690d8944e7600487da8b2a',
    v_entries,
    'project-baseline-coordinator'
  );
  if not (v_result->>'replayed')::boolean
    and coalesce((v_result->>'inserted_event_count')::integer, -1) <> 12
  then
    raise exception 'Canonical bootstrap did not append exactly twelve events';
  end if;

  v_replay := momi_governance.reconcile_bootstrap_v1(
    'project-baseline-pre-ledger-v1',
    'd89d4c426419976631b1e411f516eea915176a6e20690d8944e7600487da8b2a',
    v_entries,
    'project-baseline-coordinator'
  );
  if not (v_replay->>'replayed')::boolean then
    raise exception 'Canonical bootstrap exact replay appended new state';
  end if;
  if v_replay->>'computed_manifest_digest' <> v_manifest then
    raise exception 'Canonical bootstrap replay returned another manifest digest';
  end if;
  if v_replay->'mapping' <> v_result->'mapping' then
    raise exception 'Canonical bootstrap replay returned another decision mapping';
  end if;

  raise notice 'Project Baseline bootstrap result: %', v_result;
  raise notice 'Project Baseline bootstrap replay: %', v_replay;
end;
$$;
