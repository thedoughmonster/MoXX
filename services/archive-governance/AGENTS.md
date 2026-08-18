# Archive Governance Rules

- Own archive coverage gaps, export runs, and evidence status only.
- Treat the four declared relations and rejection routine as private
  implementation details. There is no current public contract, function,
  route, or service-client authority.
- Never own or mutate source evidence stored by an archive service.
- Keep findings tied to immutable evidence references.
- Operator documentation grants no identity, credential, role, permission, or
  runtime access to the private objects.
- Any future service client must use a separately accepted versioned owner
  contract with separately authorized runtime and role access.
