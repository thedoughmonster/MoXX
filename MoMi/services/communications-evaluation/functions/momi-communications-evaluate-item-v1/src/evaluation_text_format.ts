export const evaluationTextFormat = {
  type: "json_schema",
  name: "momi_communications_evaluation_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "decision", "validation", "urgency", "impact", "confidence",
      "rationale", "flags", "merge_suggestions", "derived_records",
    ],
    properties: {
      decision: { enum: [
        "retain", "archive", "noise", "merge_review", "needs_human_review",
      ] },
      validation: { enum: [
        "supported", "uncertain", "conflicted", "not_verifiable",
      ] },
      urgency: { enum: ["none", "low", "medium", "high", "critical"] },
      impact: { enum: ["low", "medium", "high"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rationale: { type: "string", maxLength: 1200 },
      flags: {
        type: "array", maxItems: 12,
        items: { type: "string", maxLength: 120 },
      },
      merge_suggestions: {
        type: "array", maxItems: 8,
        items: { type: "string", maxLength: 240 },
      },
      derived_records: {
        type: "array", maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "kind", "key", "summary", "details", "work_scope",
            "destination_hint", "confidence",
          ],
          properties: {
            kind: { enum: ["task", "knowledge", "incident", "alert", "other"] },
            key: { type: ["string", "null"], maxLength: 160 },
            summary: { type: "string", maxLength: 500 },
            details: { type: ["string", "null"], maxLength: 2000 },
            work_scope: { enum: [
              "software_repository", "business_operations", "personal", "unknown",
            ] },
            destination_hint: { enum: [
              "github_issue", "clickup", "none", "undetermined",
            ] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
} as const
