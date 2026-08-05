import { type Allergen, type VersionSet } from '../../lib/contracts';

export type Money = {
  currency: string;
  amountMinor: number;
};

export type FulfillmentWindow = {
  id: string;
  eyebrow: string;
  day: string;
  date: string;
  time: string;
  availability: 'available' | 'limited' | 'closed' | 'sold_out';
};

export type Product = {
  id: string;
  itemVersion: number;
  name: string;
  description: string;
  price: Money;
  art: 'berry' | 'chocolate' | 'citrus' | 'vanilla';
  badge?: string;
  allergens: Allergen[];
  allergenStatus: 'verified' | 'unverified';
  maximumQuantity: number;
};

export type PreorderFixture = {
  source: 'fixture' | 'live';
  surfaceId: string | null;
  locationId: string | null;
  versions: VersionSet | null;
  surfaceName: string;
  locationName: string;
  freshnessLabel: string;
  cancellationPolicy: {
    summary: string;
    customerCancellationAllowed: boolean;
    customerModificationAllowed: boolean;
  };
  fulfillmentWindows: FulfillmentWindow[];
  allergenOptions: Array<{ id: Allergen; label: string }>;
  products: Product[];
};

export type CartQuantities = Record<string, number>;

export function formatMoney(money: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency
  }).format(money.amountMinor / 100);
}
