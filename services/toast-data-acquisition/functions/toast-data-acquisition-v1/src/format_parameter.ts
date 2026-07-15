import type { JsonValue } from "./json_types.ts";
import type { OperationParameter } from "./registry_types.ts";

export function formatRegisteredParameter(
  parameter: OperationParameter,
  value: JsonValue,
): string {
  let formatted: string;
  if (parameter.data_type === "string") {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Parameter ${parameter.parameter_key} must be a string`);
    }
    formatted = value;
  } else if (parameter.data_type === "integer") {
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw new Error(
        `Parameter ${parameter.parameter_key} must be an integer`,
      );
    }
    formatted = String(value);
  } else if (parameter.data_type === "boolean") {
    if (typeof value !== "boolean") {
      throw new Error(`Parameter ${parameter.parameter_key} must be boolean`);
    }
    formatted = String(value);
  } else if (parameter.data_type === "timestamp") {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
      throw new Error(
        `Parameter ${parameter.parameter_key} must be a timestamp`,
      );
    }
    formatted = value;
  } else {
    if (typeof value !== "string" || !/^[0-9]{8}$/.test(value)) {
      throw new Error(`Parameter ${parameter.parameter_key} must be a date`);
    }
    formatted = value;
  }
  if (
    parameter.validation_pattern &&
    !new RegExp(parameter.validation_pattern).test(formatted)
  ) {
    throw new Error(`Parameter ${parameter.parameter_key} failed validation`);
  }
  return formatted;
}
