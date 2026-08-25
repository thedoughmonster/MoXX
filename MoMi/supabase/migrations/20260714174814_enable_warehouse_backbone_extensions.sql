-- service-owner: momi-event-routing

create extension if not exists pgmq cascade;
create extension if not exists pg_cron with schema pg_catalog;

revoke all on schema pgmq from public, anon, authenticated;
revoke execute on all functions in schema pgmq
  from public, anon, authenticated;

revoke all on schema cron from public, anon, authenticated;
revoke all on all tables in schema cron
  from public, anon, authenticated;

comment on extension pgmq is
  'Private durable queues used for one queue per MoMi subscriber.';
comment on extension pg_cron is
  'Durable reconciliation and scheduling for the warehouse backbone.';
