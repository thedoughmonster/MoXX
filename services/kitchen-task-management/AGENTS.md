# Kitchen Task Management Rules

- Own canonical kitchen task UUIDs, recurrence, assignments, state, and audit history.
- Treat every Trello identifier as a typed external reference, never a primary key.
- Append audit events; never rewrite historical actor or timestamp evidence.
- Attribute Trello actions from the archived member identity snapshot and mapping.
- Consume each Trello action ID exactly once.
- Prepare desired Trello mutations without calling Trello directly.
- Keep assignment independent from Trello list-based workflow state.
- Preserve completed audit history after any external card is archived.
