-- service-owner: toast-webhook-ingestion

insert into toast_raw.webhook_subscriptions (
  subscription_key, toast_category, public_route, subscription_status
) values
  ('menus', 'menus', '/functions/v1/toast-webhooks-ingest-v1', 'pending'),
  ('packaging', 'packaging', '/functions/v1/toast-webhooks-ingest-v1', 'pending'),
  ('restaurant-availability', 'restaurant_availability',
    '/functions/v1/toast-webhooks-ingest-v1', 'pending'),
  ('ordering-schedule', 'order_schedule',
    '/functions/v1/toast-webhooks-ingest-v1', 'pending');

insert into toast_raw.webhook_event_types values
  ('menus', 'menus', 'menus_updated'),
  ('packaging', 'packaging', 'packaging_updated'),
  ('packaging', 'partner', 'packaging_updated'),
  ('restaurant-availability', 'restaurant_availability', 'availability_online'),
  ('restaurant-availability', 'restaurant_availability', 'availability_offline'),
  ('restaurant-availability', 'restaurant_availability_toggle', 'toggle_availability_online'),
  ('restaurant-availability', 'restaurant_availability_toggle', 'toggle_availability_offline'),
  ('ordering-schedule', 'ordering_schedule', 'ordering_schedule_updated');
