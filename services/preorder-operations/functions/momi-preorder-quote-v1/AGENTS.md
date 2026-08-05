# Preorder Quote Function Rules

- Accept only the frozen customer-safe quote command.
- Never accept customer identity, payment data, or provider tokens.
- Treat command reuse with different cart data as a conflict.
- Persist only database-authoritative accepted quote receipts.
- Fail closed on stale versions, cutoff, capacity, and item evidence. An empty
  avoidance list may use explicitly unverified allergen data without a safety
  claim; any requested avoidance without evidence remains fail closed.
- Never log the request body or revalidation token.
