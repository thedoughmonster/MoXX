import type {
  EmbeddedSquareCard,
  SourceTokenHandoff,
  SquareCardMountResult,
  SquareChargeVerificationDetails,
  SquareSandboxPublicConfig,
  SquareSdk,
  SquareTokenHandoffResult
} from './types';

type CardState = 'ready' | 'tokenizing' | 'consumed' | 'destroyed';
const amount = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const currency = /^[A-Z]{3}$/;
const sandboxApplicationId = /^sandbox-sq0idb-[A-Za-z0-9_-]{8,128}$/;

export async function mountEmbeddedSquareCard(input: Readonly<{
  config: SquareSandboxPublicConfig;
  sdk: SquareSdk;
  target: HTMLElement;
}>): Promise<SquareCardMountResult> {
  if (
    !sandboxApplicationId.test(input.config.applicationId) ||
    input.config.locationId.length < 2 ||
    input.config.locationId.length > 64
  ) {
    return { status: 'unavailable', reason: 'configuration_invalid' };
  }

  let providerCard;
  try {
    const payments = input.sdk.payments(
      input.config.applicationId,
      input.config.locationId
    );
    providerCard = await payments.card();
    await providerCard.attach(input.target);
  } catch {
    return { status: 'unavailable', reason: 'card_mount_failed' };
  }

  let state: CardState = 'ready';
  const card: EmbeddedSquareCard = {
    destroy: async () => {
      if (state === 'destroyed') return;
      state = 'destroyed';
      await providerCard.destroy().catch(() => false);
    },
    tokenizeAndHandoff: async (
      details: SquareChargeVerificationDetails,
      handoff: SourceTokenHandoff
    ): Promise<SquareTokenHandoffResult> => {
      if (state === 'destroyed') {
        return { status: 'blocked', reason: 'payment_form_destroyed' };
      }
      if (state === 'consumed') {
        return { status: 'blocked', reason: 'token_already_handed_off' };
      }
      if (state === 'tokenizing') {
        return { status: 'blocked', reason: 'tokenization_in_progress' };
      }
      if (!amount.test(details.amount) || !currency.test(details.currencyCode)) {
        return { status: 'retryable', reason: 'verification_details_invalid' };
      }

      state = 'tokenizing';
      let result;
      try {
        result = await providerCard.tokenize(details);
      } catch {
        state = 'ready';
        return { status: 'retryable', reason: 'tokenization_failed' };
      }

      if (
        result.status !== 'OK' ||
        typeof result.token !== 'string' ||
        result.token.length < 1 ||
        result.token.length > 512
      ) {
        state = 'ready';
        return { status: 'retryable', reason: 'tokenization_failed' };
      }

      state = 'consumed';
      try {
        await handoff(result.token);
      } catch {
        return {
          status: 'indeterminate',
          reason: 'source_token_handoff_indeterminate'
        };
      }
      return { status: 'handed_off' };
    }
  };
  return { status: 'ready', card };
}
