# Capture Human Message v1

## ELI5

The persistent host relay sends each committed user-to-user OpenWebUI message
here. Replayed messages collapse by stable source identity and content.

## Trigger And Input

The relay posts stable account, user, conversation, message, optional parent,
sender, timestamp, content, metadata, and idempotency identity with a
purpose-bound credential.

## Output

The response contains only disposition, archive item identity, and content hash.

## Side Effects

The function calls the archive owner's structured append contract. It does not
evaluate, mutate, or expose messages.

## Failure Handling

Persistence failure returns a server error so the durable relay cursor does not
advance.

## Tests

Run `pnpm check -- --service communications-archive`.
