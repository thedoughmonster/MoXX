# MoXi UI Agent Contract

This `MoXi/` workspace in `thedoughmonster/MoXX` owns Dough Monster web
presentation surfaces. Linear is the sole active work-item authority; the
retained `moxi-web` repository and its GitHub issues are historical evidence,
not execution instructions.

## Hard rules

- Keep one issue owner and one isolated branch/worktree per change after the initial repository bootstrap.
- Use pnpm, strict TypeScript, React DOM, Vite, and Cloudflare Workers Static Assets.
- Cloudflare owns static delivery and response policy only. Do not add preorder business logic or a second backend to the Worker.
- Browser code may call only accepted versioned Supabase Edge Functions. Do not access tables directly or embed service-role, Square, database, webhook, or other secret credentials.
- Treat all `VITE_*` values as public. Never place a secret in a Vite environment variable.
- Keep public configuration explicit, validate it, and fail safely when launch-required configuration is absent.
- Preserve exact hostname scope. Do not add wildcard routes/domains or any hostname other than an accepted issue target.
- Keep Sentry free of customer payloads, authentication tokens, payment/card data, request bodies, and session replay on customer/payment routes.
- Use semantic, accessible HTML and include loading, pending, failure, and recovery states when the product slice activates them.
- Run focused checks while iterating and one final `pnpm check` before handoff. Inspect rendered output before declaring UI work complete.
- Do not deploy, mutate provider settings, push, create a PR, or handle credentials without exact authority from the owning task.
