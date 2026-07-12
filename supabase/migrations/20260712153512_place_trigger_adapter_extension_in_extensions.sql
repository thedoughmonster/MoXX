drop extension pg_net;
create extension pg_net with schema extensions;

comment on extension pg_net is
  'Async transport for ADR 0004 allowlisted durable worker wake-ups only.';
