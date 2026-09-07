# LikeC4 source migration and tunnel cutover

This workspace is the target home for the MOXX architecture model. The existing
hosted model must remain available until its complete source has been reconciled
here and the replacement origin has passed validation.

## Current protected route

- Public hostname: `https://architecture.doh.monster`
- Cloudflare Access application: the existing Watchdog dashboard application
- Tunnel: `symphony-dashboard-ovh-vps`
- Current origin: `http://127.0.0.1:4120`
- HTTP Host Header: `localhost`
- Current source on the tunnel host: `/home/ubuntu/symphony-watchdog/interface`

No tunnel token, origin certificate, Access credential, or secret belongs in
this repository.

## Non-disruptive migration

1. Preserve a recoverable copy or commit of the complete existing interface
   source before changing its service.
2. Import its model, views, enrichment metadata, links, and validators into this
   workspace. Reconcile rather than overwrite the costing discovery model.
3. Run `pnpm install --frozen-lockfile` and `pnpm check` on the tunnel host.
4. Start the candidate on an unused loopback port and verify its root page and
   important views locally with `Host: localhost`.
5. Update the existing systemd origin service to this workspace and port 4120,
   then restart it. Do not change the Cloudflare hostname, Access policy, or
   other tunnel routes.
6. Verify both an authenticated load and an unauthenticated Access challenge at
   `https://architecture.doh.monster`. Roll the origin service back immediately
   if the new dashboard, assets, or navigation fail.
7. Retire the Watchdog copy only in a later cleanup after the MOXX source and
   public route have remained healthy.

The existing route is the rollback path throughout the migration. A source move
is not complete until both the full model and the protected public view have
been verified.
