# LikeC4 source migration and tunnel cutover

This workspace is now the source home for the complete MOXX architecture model.
The former Watchdog model has been reconciled with the current MoMi service
catalog and the costing discovery model. The existing hosted origin must remain
available until this replacement passes validation on the tunnel host.

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

1. Merge the validated architecture branch into MoXX and pull it on the tunnel
   host without modifying the current Watchdog origin.
2. Run `pnpm install --frozen-lockfile` and `pnpm check` in `architecture/` on
   the tunnel host.
3. Start the candidate on an unused loopback port and verify its root page and
   important views locally with `Host: localhost`.
4. Preserve a recoverable copy of the old systemd unit, then update the existing
   origin service to this workspace and port 4120,
   then restart it. Do not change the Cloudflare hostname, Access policy, or
   other tunnel routes.
5. Verify both an authenticated load and an unauthenticated Access challenge at
   `https://architecture.doh.monster`. Roll the origin service back immediately
   if the new dashboard, assets, or navigation fail.
6. Retire the Watchdog copy only in a later cleanup after the MOXX source and
   public route have remained healthy.

The existing route is the rollback path throughout the migration. A source move
is not complete until both the full model and the protected public view have
been verified.
