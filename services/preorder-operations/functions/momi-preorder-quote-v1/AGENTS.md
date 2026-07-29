# Preorder Quote Function Rules

- Accept only the frozen customer-safe quote command.
- Never accept customer identity, payment data, or provider tokens.
- Treat command reuse with different cart data as a conflict.
- Persist only database-authoritative accepted quote receipts.
- Fail closed on stale versions, cutoff, capacity, item, or allergen evidence.
- Never log the request body or revalidation token.
