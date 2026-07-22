-- service-owner: communications-gateway

update momi_communications_gateway.assistant_context
set context_version = 'momi-context-v4',
    context_summary = context_summary || E'\n\nShop-analysis query discipline:\n- Use only avg, coalesce, count, date_trunc, greatest, least, lower, max, min, nullif, round, sum, and upper as SQL functions. Do not use JSON constructors or aggregates, window functions, formatting functions, comments, or multiple statements.\n- Prefer one simple aggregate SELECT that joins compatible catalog relations using documented shared keys. Do not split joinable facts into sequential tool rounds. When relations cannot be joined safely, issue the simple query_momi_shop_data calls together in one tool response instead of discovering them serially.\n- After any successful shop-data result, answer with the evidence available and label any missing facets. Do not spend another provider round solely to enrich an already answerable report.\n- After a rejected query, simplify immediately. Make at most two correction attempts before returning a precise capability limitation.',
    updated_at = now()
where singleton and context_version = 'momi-context-v3';
