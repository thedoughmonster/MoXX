-- service-owner: warehouse-read-api

comment on function momi_api.analysis_source_entities_v1() is
  'Static owner-mediated source for curated shop-analysis views; direct gateway naming is blocked because the gateway has no USAGE on momi_api.';
