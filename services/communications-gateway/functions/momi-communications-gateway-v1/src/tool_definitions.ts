export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_momi_canonical_record",
      description: "Read one approved canonical MoMi shop record with provenance and freshness.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["query_kind", "subject_entity_id", "scope_entity_id"],
        properties: {
          query_kind: { enum: ["order", "payment", "menu", "schedule", "stock"] },
          subject_entity_id: { type: "string", format: "uuid" },
          scope_entity_id: { type: ["string", "null"], format: "uuid" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_momi_log",
      description: "Confirm the user's already-resolved explicit request to create one MoMi log.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: [],
        properties: {},
      },
    },
  },
] as const
