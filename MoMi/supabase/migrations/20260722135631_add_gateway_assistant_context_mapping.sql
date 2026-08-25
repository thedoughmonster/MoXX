-- service-owner: communications-gateway

create table momi_communications_gateway.assistant_context (
  singleton boolean primary key default true check (singleton),
  context_version text not null check (context_version ~ '^momi-context-v[0-9]+$'),
  assistant_name text not null check (length(assistant_name) between 1 and 100),
  organization_name text not null check (length(organization_name) between 1 and 200),
  organization_aliases text[] not null
    check (cardinality(organization_aliases) between 1 and 20),
  context_summary text not null check (length(context_summary) between 1 and 4000),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into momi_communications_gateway.assistant_context (
  context_version, assistant_name, organization_name,
  organization_aliases, context_summary, enabled
) values (
  'momi-context-v1',
  'MoMi',
  'Dough Monster',
  array['Dough Monster', 'DoughMonster'],
  'MoMi supports Dough Monster operations. Canonical shop records include orders, payments, menu items, schedules, and stock, with provenance and freshness. Treat references to the shop, business, company, or Dough Monster as this organization.',
  true
);

alter table momi_communications_gateway.assistant_context enable row level security;
revoke all on table momi_communications_gateway.assistant_context
  from public, anon, authenticated;
grant select on table momi_communications_gateway.assistant_context to service_role;
