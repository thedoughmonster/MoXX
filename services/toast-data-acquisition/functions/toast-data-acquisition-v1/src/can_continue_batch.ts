import {
  batchPersistenceMarginMs,
  batchShutdownMarginMs,
} from "./constants.ts";

export function canContinueBatch(
  deadlineMs: number,
  nowMs: number,
  requestTimeoutMs: number,
): boolean {
  return nowMs + requestTimeoutMs + batchPersistenceMarginMs <
    deadlineMs - batchShutdownMarginMs;
}
