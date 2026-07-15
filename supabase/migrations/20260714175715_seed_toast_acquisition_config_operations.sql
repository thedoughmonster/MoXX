-- service-owner: toast-data-acquisition

create temporary table toast_config_operation_seed (
  resource_key text, list_operation text, detail_operation text,
  path_segment text, resource_type text
) on commit drop;

insert into toast_config_operation_seed values
  ('alternate_payment_types', 'alternatePaymentTypesGet', 'alternatePaymentTypesGuidGet', 'alternatePaymentTypes', 'alternate_payment_type'),
  ('break_types', 'breakTypesGet', 'breakTypesGuidGet', 'breakTypes', 'break_type'),
  ('cash_drawers', 'cashDrawersGet', 'cashDrawersGuidGet', 'cashDrawers', 'cash_drawer'),
  ('dining_options', 'diningOptionsGet', 'diningOptionsGuidGet', 'diningOptions', 'dining_option'),
  ('discounts', 'discountsGet', 'discountsGuidGet', 'discounts', 'discount'),
  ('menu_groups', 'menuGroupsGet', 'menuGroupsGuidGet', 'menuGroups', 'menu_group'),
  ('menu_items', 'menuItemsGet', 'menuItemsGuidGet', 'menuItems', 'menu_item'),
  ('modifier_groups', 'menuOptionGroupsGet', 'menuOptionGroupsGuidGet', 'menuOptionGroups', 'modifier_group'),
  ('menus', 'menusGet', 'menusGuidGet', 'menus', 'menu_configuration'),
  ('no_sale_reasons', 'noSaleReasonsGet', 'noSaleReasonsGuidGet', 'noSaleReasons', 'no_sale_reason'),
  ('payout_reasons', 'payoutReasonsGet', 'payoutReasonsGuidGet', 'payoutReasons', 'payout_reason'),
  ('pre_modifier_groups', 'preModifierGroupsGet', 'preModifierGroupsGuidGet', 'preModifierGroups', 'pre_modifier_group'),
  ('pre_modifiers', 'preModifiersGet', 'preModifiersGuidGet', 'preModifiers', 'pre_modifier'),
  ('price_groups', 'priceGroupsGet', 'priceGroupsGuidGet', 'priceGroups', 'price_group'),
  ('printers', 'printersGet', 'printersGuidGet', 'printers', 'printer'),
  ('restaurant_services', 'restaurantServicesGet', 'restaurantServicesGuidGet', 'restaurantServices', 'restaurant_service'),
  ('revenue_centers', 'revenueCentersGet', 'revenueCentersGuidGet', 'revenueCenters', 'revenue_center'),
  ('sales_categories', 'salesCategoriesGet', 'salesCategoriesGuidGet', 'salesCategories', 'sales_category'),
  ('service_areas', 'serviceAreasGet', 'serviceAreasGuidGet', 'serviceAreas', 'service_area'),
  ('service_charges', 'serviceChargesGet', 'serviceChargesGuidGet', 'serviceCharges', 'service_charge'),
  ('tables', 'tablesGet', 'tablesGuidGet', 'tables', 'table'),
  ('tax_rates', 'taxRatesGet', 'taxRatesGuidGet', 'taxRates', 'tax_rate'),
  ('void_reasons', 'voidReasonsGet', 'voidReasonsGuidGet', 'voidReasons', 'void_reason'),
  ('tip_withholding', 'tipWithholdingGet', null, 'tipWithholding', 'tip_withholding');

insert into toast_acquisition.operations (
  operation_key, source_operation_id, path_template, resource_type,
  response_kind, pagination_kind, requires_window,
  exact_resource_only, is_enabled
)
select
  'toast.config.' || resource_key || '.list.v1',
  list_operation,
  '/config/v2/' || path_segment,
  resource_type,
  case when detail_operation is null then 'document' else 'collection' end,
  case when detail_operation is null then 'none' else 'cursor' end,
  false, false, true
from toast_config_operation_seed;

insert into toast_acquisition.operations (
  operation_key, source_operation_id, path_template, resource_type,
  response_kind, pagination_kind, requires_window,
  exact_resource_only, is_enabled
)
select
  'toast.config.' || resource_key || '.get.v1',
  detail_operation,
  '/config/v2/' || path_segment || '/{guid}',
  resource_type,
  'document', 'none', false, true, true
from toast_config_operation_seed
where detail_operation is not null;

insert into toast_acquisition.operation_parameters
select operation_key, 'pageToken', 'query', 'string', false, null
from toast_acquisition.operations
where operation_key like 'toast.config.%.list.v1'
  and pagination_kind = 'cursor';

insert into toast_acquisition.operation_parameters
select operation_key, 'lastModified', 'query', 'timestamp', false, null
from toast_acquisition.operations
where operation_key like 'toast.config.%.list.v1'
  and pagination_kind = 'cursor';

insert into toast_acquisition.operation_parameters
select operation_key, 'guid', 'path', 'string', true, '^[0-9a-fA-F-]+$'
from toast_acquisition.operations
where operation_key like 'toast.config.%.get.v1';
