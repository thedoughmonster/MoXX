# Retired Edge Functions

Each JSON file temporarily permits one undeclared hosted Edge Function while
its callers are checked and removal is scheduled. Expired manifests fail the
inventory gate. They never cause automatic deletion and never authorize
`--prune`.
