create extension if not exists pg_net;

comment on extension pg_net is
  'Async transport for ADR 0004 allowlisted durable worker wake-ups only.';
