-- service-owner: toast-data-acquisition

create index resource_versions_toast_order_archive_key_idx
  on toast_raw.resource_versions (
    ('archive:'::text || resource_version_id::text)
  )
  where source_system = 'toast' and resource_type = 'order';

comment on index toast_raw.resource_versions_toast_order_archive_key_idx is
  'Supports exact archive-prefixed order version reads without scanning all orders.';
