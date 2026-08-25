# Agent-control relocation

`agent-control` and `agent-control-host` are owned by the dedicated public
`thedoughmonster/momi-symphony` repository on `main`.

This repository no longer contains, builds, hosts, deploys, or accepts feature
changes for either service or their Edge Function adapters. Do not recreate the
removed service or adapter paths here.

The seven files below remain byte-identical in `supabase/migrations` because
they are already applied to development and migration history is immutable:

- `20260814125234_create_agent_control.sql`
- `20260814125236_add_agent_control_dispatch_trigger_adapter.sql`
- `20260814170037_configure_agent_control_host_endpoint.sql`
- `20260814192000_add_agent_control_action_catalog.sql`
- `20260815061500_add_agent_control_parent_runs.sql`
- `20260816083201_add_simple_discovery_recovery.sql`
- `20260816183827_add_agent_control_dead_letter_recovery.sql`

They are historical evidence, not authority for new changes. All future
`momi_agent_ops` migrations and development deployments originate only from
the dedicated repository. Production currently has no `momi_agent_ops` schema,
matching migration versions, or agent-control Edge Functions; this relocation
does not activate production.
