import { batchShutdownMarginMs } from "./constants.ts";

export function canContinueBatch(deadlineMs: number, nowMs: number): boolean {
  return nowMs < deadlineMs - batchShutdownMarginMs;
}
