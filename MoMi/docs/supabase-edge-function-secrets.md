# Branch-scoped Edge Function secrets

Use this guide only to place a runtime secret directly into its intended
Supabase scope and to verify its name is present. It does not authorize a
provider change, function deployment, secret rotation, or value retrieval.

Supabase branches are isolated environments, and the dashboard branch selector
controls which environment is being changed. Supabase documents both the
[branch selector](https://supabase.com/docs/guides/deployment/branching/dashboard#making-changes-to-a-branch)
and the [Edge Function secrets UI](https://supabase.com/docs/guides/functions/secrets#production-secrets).

## Select the target before entry

Confirm all three text cues in one browser window: the branch selector label,
the project reference in the dashboard URL, and the same reference in the
hosted function URL. The canonical references come from `workspace.json`.

| Target | Branch label | Project reference | Hosted function URL cue | Secrets page |
| --- | --- | --- | --- | --- |
| Production | production (`prod` in MoMi) | `viodfldzuoypnpqaagag` | `https://viodfldzuoypnpqaagag.supabase.co/functions/v1/...` | [Production Edge Function secrets](https://supabase.com/dashboard/project/viodfldzuoypnpqaagag/functions/secrets) |
| Persistent development | `dev` | `xtbraqnlskmqxinjxxdn` | `https://xtbraqnlskmqxinjxxdn.supabase.co/functions/v1/...` | [Development Edge Function secrets](https://supabase.com/dashboard/project/xtbraqnlskmqxinjxxdn/functions/secrets) |

1. Open the Supabase project and use the top-bar branch selector to choose
   production or the persistent `dev` branch.
2. Navigate by the text path **Edge Functions > Secrets**. The direct URL path
   is `/dashboard/project/<project-reference>/functions/secrets`.
3. Compare the selected branch label, the URL's `<project-reference>`, and the
   matching row above. Stop if any cue disagrees or the branch label is
   ambiguous. Do not enter anything until all three cues agree.

Branch function URLs use the selected branch's project reference, as shown by
Supabase's [hosted function URL format](https://supabase.com/docs/guides/functions/quickstart-dashboard#step-6-get-your-function-url-and-keys).

## Place and verify names only

Only the credential owner enters a value. The owner enters it directly in the
selected Supabase page; no intermediary handles it.

1. Reconfirm the three target cues immediately before each entry.
2. Enter one required name and its value in the dashboard, then save it. Do not
   paste a multi-secret block because it weakens the per-name target check.
3. After saving, verify only that the expected name appears in the selected
   branch's list. Record only `target`, `project reference`, `name`, and
   `present` or `missing`.
4. Repeat the three-cue check before changing branches. A secret in one scope
   does not establish its presence in the other scope.

For the Trello work, the illustrative names-only checklist is:

- [ ] `TRELLO_API_KEY`
- [ ] `TRELLO_API_TOKEN`
- [ ] `TRELLO_WEBHOOK_SECRET`

These names do not authorize Trello activation, registration, or any other
provider mutation. Other services take their required names from the owning
`service.json`; do not infer names or values.

Never use a hosted store as a fetch-and-copy source. If another scope needs the
same credential, its owner re-enters it from the approved source directly into
that scope. Do not use `supabase secrets list` for this procedure because its
output includes value-derived digests rather than names alone.

## Verify the hosted function safely

Name presence and function liveness are separate checks. Presence does not
prove that a value is correct, and a liveness probe does not prove that a
credential works.

1. Reconfirm the target branch and project reference.
2. Select a side-effect-free method and acceptable status declared by the
   function's `function.json` probe. For the Trello names above, the
   [`trello-webhook-inventory-v1` manifest](../services/trello-data-acquisition/functions/trello-webhook-inventory-v1/function.json)
   declares `GET /functions/v1/trello-webhook-inventory-v1` with status `405`.
3. Run the probe only through the existing controlled hosted verification path.
   Do not add an authorization header, credential-bearing query, request body,
   debug output, or alternate deployment path.
4. Record only the target, project reference, function name, HTTP method,
   status, and `pass` or `fail`. Do not retain response headers or bodies.
5. Stop and escalate to the credential owner if the target is ambiguous, a
   required name is missing, or the declared probe fails. Do not diagnose by
   inspecting a value or by invoking a business operation.

## Credential authorities and prohibitions

| Task | Existing authority |
| --- | --- |
| Edge Function runtime/API secret placement | Selected branch's Supabase **Edge Functions > Secrets** page |
| Repository and Edge Function deployment credentials | Protected GitHub environments used by the two authorized workflows |
| GitHub CLI account | Approved release host's GitHub CLI credential store |
| Development Supabase account credential | Protected GitHub `dev` environment secret |
| Production Supabase account credential | Protected GitHub `prod` environment for workflows; approved release host's authenticated Supabase CLI profile for the coordinator |
| Database login | Short-lived by default; an accepted Linear issue may authorize the [active-development non-expiring exception](release-credentials.md#active-development-non-expiring-exception) |

See [Release credentials](release-credentials.md) and the
[Agent Deployment Procedure](agent-deployment-procedure.md) for those existing
authorities. This guide creates no local runtime store or deployment fallback.

Never put a secret value in chat, task or agent prompts, shell commands or
history, environment files, repository files, issues, pull requests, CI output,
logs, packets, receipts, or screenshots. Never read, print, export, copy, hash,
fingerprint, measure, or log a value for verification. Do not capture even a
redacted value, its length, or value-derived metadata.
