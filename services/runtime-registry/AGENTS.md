# Runtime Registry Rules

- Own runtime function, parameter, and trigger registration state only.
- Treat the three declared relations as private implementation details. There
  is no current public contract, function, public read, public command, route,
  or accepted service-client role.
- Keep route, owner, version, authentication, and activation facts explicit.
- Do not own function implementation or business datasets.
- Existing direct private readers remain removal-only legacy debt. They are not
  public consumers and authorize no new reader.
- Any future interface requires a separately accepted versioned owner contract,
  caller compatibility and cutover, failure semantics, verification, and
  separately authorized role and grant work.
