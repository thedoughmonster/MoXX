-- service-owner: warehouse-read-api

comment on function momi_api.analysis_source_entities_v1() is
  'Static owner-mediated source for curated shop-analysis views; gateway execution is usable only through stored view dependencies because the gateway has no USAGE on momi_api.';
