-- service-owner: communications-gateway

update momi_communications_gateway.routing_policy
set router_prompt_version = 'momi-router-v2',
    updated_at = now()
where singleton;
