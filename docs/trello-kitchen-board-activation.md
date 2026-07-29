# Kitchen Operations Board Activation

This procedure is a controlled development acceptance event for issue #211. It
does not authorize deployment or provider mutation by itself.

## Target State

- Board short link: `qdzZg93X`; resolve and retain Trello's canonical board ID.
- Board name: `Kitchen Operations`.
- Open list order: `Unassigned`, `Today`, `In Progress`, `Blocked`, `Done`.
- Preserve every existing card, including `Turn off burners and broiler` and
  `Dispose of doughnuts`.
- Move those preserved cards to `Unassigned` by exact canonical card and list
  IDs after the list order is proven.
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
2. Enqueue and execute one durable board snapshot for `qdzZg93X`; stop on a
   board-name mismatch, duplicate target name, incorrect list order, or missing
   preserved card.
3. Enqueue and execute one acquisition-owned complete webhook inventory. Stop
   if it shows a conflicting board or callback registration.
4. Probe the exact configured callback with HEAD and require `200`.
5. If no exact active webhook exists, enqueue one prepared registration with
   the inventory job reference and HEAD evidence reference, then execute its
   single POST. Never inventory provider state from the delivery service.
6. Enqueue one desired-state move for each preserved card using the exact board,
   card, and `Unassigned` list IDs.
7. Reacquire both the board snapshot and webhook inventory. Verify exact list
   order, unchanged card identities, both cards in `Unassigned`, and exactly one
   active webhook for the board and callback.
8. After a controlled Trello action, verify one authenticated, member-attributed
   webhook evidence row and confirm the non-secret client marker is preserved.

An ambiguous list or webhook create stops activation. Reacquire through the
owning acquisition function before any follow-up; never retry a create blindly.

## Rollback

No automatic rollback archives or deletes a list because staff may have begun
using it. A failed activation leaves durable source and delivery evidence and
requires an owner-approved follow-up operation.
