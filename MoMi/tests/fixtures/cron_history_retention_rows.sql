insert into cron.job_run_details
  (runid, jobid, status, return_message, start_time, end_time)
values
  (1, 1, 'running', null, now() - interval '32 days', null),
  (2, 2, 'succeeded', 'SELECT 1', now() - interval '31 days 1 second', now() - interval '31 days'),
  (3, 3, 'failed', 'fixture failure', now() - interval '31 days 1 second', now() - interval '31 days'),
  (4, 4, 'succeeded', 'SELECT 1', now() - interval '29 days 1 second', now() - interval '29 days'),
  (5, 5, 'failed', 'fixture failure', now() - interval '29 days 1 second', now() - interval '29 days'),
  (6, 6, 'running', null, now() - interval '31 days 1 second', now() - interval '31 days'),
  (7, 7, 'starting', null, now() - interval '31 days 1 second', now() - interval '31 days'),
  (8, 8, 'succeeded', 'SELECT 1', now() - interval '31 days', null),
  (9, 9, 'succeeded', 'SELECT 1', null, now() - interval '31 days'),
  (10, 10, 'succeeded', 'SELECT 1', now() - interval '31 days', now() - interval '31 days 1 second'),
  (11, 11, 'succeeded', 'SELECT 1', '-infinity', now() - interval '31 days'),
  (12, 12, 'failed', 'fixture failure', '-infinity', '-infinity'),
  (13, 13, 'succeeded', 'SELECT 1', now() - interval '31 days', 'infinity'),
  (14, 14, 'succeeded', 'SELECT 1', now() - interval '31 days 1 second', now() - interval '31 days'),
  (15, 15, 'sending', null, now() - interval '31 days 1 second', now() - interval '31 days'),
  (16, 16, 'unknown', 'unknown', now() - interval '31 days 1 second', now() - interval '31 days');

insert into momi_cron_history.incident_holds (runid, hold_key, reason_code)
values (14, 'fixture-incident-hold', 'incident');
