import { claimTick } from "./claim_tick.ts";
import { collectProviderSample } from "./collect_provider_sample.ts";
import { readTickReceipt } from "./read_tick_receipt.ts";
import { recordProviderSample } from "./record_provider_sample.ts";
import type { GovernorDependencies } from "./types.ts";

export const governorDependencies: GovernorDependencies = {
  claim: claimTick,
  collect: collectProviderSample,
  record: recordProviderSample,
  readReceipt: readTickReceipt,
};
