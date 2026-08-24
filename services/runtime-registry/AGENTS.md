# Runtime Registry Rules

- Own runtime function, parameter, and trigger registration state only.
- Treat the three declared relations as private implementation details.
- Expose only `momi.runtime.active_trigger_resolution.v1` through its fixed,
  non-enumerating resolver routines and declared exact consumer-role grants.
- Do not grant schema-wide access or treat shared hosted credentials as
  per-workload identity.
- Keep route, owner, version, authentication, and activation facts explicit.
- Do not own function implementation or business datasets.
- Existing direct private readers remain removal-only legacy debt. They are not
  public consumers and authorize no new reader.
- Any future interface beyond the accepted resolver contract requires a
  separately accepted versioned owner contract,
  caller compatibility and cutover, failure semantics, verification, and
  separately authorized role and grant work.
