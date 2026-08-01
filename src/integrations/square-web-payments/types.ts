export type SquareSandboxPublicConfig = Readonly<{
  applicationId: string;
  locationId: string;
}>;

export type SquareBillingContact = Readonly<{
  addressLines?: readonly string[];
  city?: string;
  countryCode?: string;
  email?: string;
  familyName?: string;
  givenName?: string;
  phone?: string;
  postalCode?: string;
  state?: string;
}>;

export type SquareChargeVerificationDetails = Readonly<{
  amount: string;
  billingContact?: SquareBillingContact;
  currencyCode: string;
  customerInitiated: true;
  intent: 'CHARGE';
  sellerKeyedIn: false;
}>;

export type SquareTokenizeResult = Readonly<{
  errors?: readonly unknown[];
  status: string;
  token?: string;
}>;

export interface SquareCard {
  attach(target: HTMLElement): Promise<void>;
  destroy(): Promise<boolean>;
  tokenize(details: SquareChargeVerificationDetails): Promise<SquareTokenizeResult>;
}

export interface SquarePayments {
  card(): Promise<SquareCard>;
}

export interface SquareSdk {
  payments(applicationId: string, locationId: string): SquarePayments;
}

export interface SquareSdkHost {
  readonly hostname: string;
  readonly isSecureContext: boolean;
  loadScript(source: string): Promise<void>;
  readSdk(): SquareSdk | undefined;
}

export type SquareSdkLoadResult =
  | Readonly<{ status: 'ready'; sdk: SquareSdk }>
  | Readonly<{
      status: 'unavailable';
      reason: 'insecure_context' | 'sdk_load_failed' | 'sdk_missing';
    }>;

export type SquareSandboxConfigResult =
  | Readonly<{ status: 'ready'; config: SquareSandboxPublicConfig }>
  | Readonly<{
      status: 'unavailable';
      reason: 'configuration_missing' | 'configuration_invalid';
    }>;

export type SourceTokenHandoff = (sourceToken: string) => Promise<void>;

export type SquareTokenHandoffResult =
  | Readonly<{ status: 'handed_off' }>
  | Readonly<{
      status: 'retryable';
      reason: 'verification_details_invalid' | 'tokenization_failed';
    }>
  | Readonly<{
      status: 'blocked';
      reason:
        | 'payment_form_destroyed'
        | 'token_already_handed_off'
        | 'tokenization_in_progress';
    }>
  | Readonly<{
      status: 'indeterminate';
      reason: 'source_token_handoff_indeterminate';
    }>;

export interface EmbeddedSquareCard {
  destroy(): Promise<void>;
  tokenizeAndHandoff(
    details: SquareChargeVerificationDetails,
    handoff: SourceTokenHandoff
  ): Promise<SquareTokenHandoffResult>;
}

export type SquareCardMountResult =
  | Readonly<{ status: 'ready'; card: EmbeddedSquareCard }>
  | Readonly<{
      status: 'unavailable';
      reason: 'configuration_invalid' | 'card_mount_failed';
    }>;
