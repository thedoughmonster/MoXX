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
      description: "Append a curated MoMi shop log only for the user's explicit log-this request.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["scope", "note", "category", "content"],
        properties: {
          scope: { enum: ["message", "turn", "range", "conversation"] },
          note: { type: ["string", "null"], maxLength: 2000 },
          category: { type: ["string", "null"], maxLength: 120 },
          content: { type: "object" },
        },
      },
    },
  },
] as const
