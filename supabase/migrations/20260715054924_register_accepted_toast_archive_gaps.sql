-- service-owner: warehouse-read-api

insert into momi_archive.product_gap_register (
  product_key, source_system, product_name, gap_description,
  export_method, cadence_days
) values
  (
    'toast-stock-before-capture', 'toast', 'Historical stock state',
    'Toast exposes current stock exceptions, not stock history before capture.',
    'No historical export is known; record the accepted gap and capture forward.',
    null
  ),
  (
    'toast-deleted-menu-history', 'toast', 'Deleted menu history',
    'Menus deleted before capture are absent from current menu APIs.',
    'No complete historical export is known; retain available manual menu exports.',
    null
  ),
  (
    'toast-deleted-configuration-history', 'toast',
    'Deleted configuration history',
    'Archived or deleted configuration entities before capture are unavailable.',
    'No complete historical export is known; retain available configuration exports.',
    null
  ),
  (
    'toast-availability-before-capture', 'toast',
    'Historical restaurant availability',
    'Restaurant availability is current-only before this archive begins.',
    'No historical export is known; record the accepted gap and capture forward.',
    null
  ),
  (
    'toast-ordering-schedule-before-capture', 'toast',
    'Historical online ordering schedules',
    'Ordering schedule revisions before capture are unavailable.',
    'No historical export is known; record the accepted gap and capture forward.',
    null
  ),
  (
    'toast-packaging-before-capture', 'toast', 'Historical packaging settings',
    'Packaging revisions before capture are unavailable.',
    'No historical export is known; record the accepted gap and capture forward.',
    null
  ),
  (
    'toast-device-history-before-capture', 'toast', 'Historical device inventory',
    'Toast exposes current devices, not a complete device history before capture.',
    'No historical export is known; record the accepted gap and capture forward.',
    null
  );
