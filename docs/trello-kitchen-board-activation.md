# Kitchen Operations Board Activation

This procedure is a controlled development acceptance event for issue #211. It
does not authorize deployment or provider mutation by itself.

## Target State

- Board short link: `qdzZg93X`; resolve and retain Trello's canonical board ID.
- Board name: `Kitchen Operations`.
- Open list order: `Unassigned`, `Today`, `In Progress`, `Blocked`, `Done`.
- Preserve every existing card, including `Turn off burners and broiler` and
  `Dispose of doughnuts`.
- Create no card, checklist, assignment, member invitation, or automation.

## Credential Handoff

After the exact reviewed commit is accepted, an owner enters values directly in
the development Supabase Edge Function Secrets UI under these opaque names:

- `TRELLO_API_KEY`
- `TRELLO_API_TOKEN`
- `TRELLO_WEBHOOK_SECRET`

Set non-secret `TRELLO_CLIENT_IDENTIFIER_PREFIX` to `momi:kitchen` and set
`TRELLO_WEBHOOK_CALLBACK_URL` to the exact deployed webhook URL. Never place a
value in Git, logs, issue text, task prompts, or chat.

## Controlled Sequence

1. Release the exact validated commit through the repository's GitHub-owned
   development release path.
2. Enqueue and execute one durable board snapshot for `qdzZg93X`.
3. Stop if the board name differs, any target list name is duplicated, the first
   three lists are out of order, or either preserved card is absent.
4. If `Blocked` is absent, enqueue and execute one prepared bottom-position list
   creation, then reacquire the board snapshot.
5. If `Done` is absent, enqueue and execute one prepared bottom-position list
   creation, then reacquire the board snapshot.
6. Verify the exact target order and unchanged existing card identities.
7. Register exactly one board webhook only after the callback HEAD probe returns
   `200`, then preserve its canonical webhook and board IDs as external refs.

An ambiguous create outcome stops activation. Reacquire the board before any
new operation; never retry the create blindly.

## Rollback

No automatic rollback archives or deletes a list because staff may have begun
using it. A failed activation leaves durable source and delivery evidence and
requires an owner-approved follow-up operation.
