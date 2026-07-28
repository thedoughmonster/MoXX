export type Money = {
  currency: 'USD';
  amountMinor: number;
};

export type FulfillmentWindow = {
  id: string;
  eyebrow: string;
  day: string;
  date: string;
  time: string;
  availability: 'available' | 'limited';
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: Money;
  art: 'berry' | 'chocolate' | 'citrus' | 'vanilla';
  badge?: string;
  allergens: string[];
  allergenStatus: 'verified' | 'unverified';
  maximumQuantity: number;
};

export type PreorderFixture = {
  surfaceName: string;
  locationName: string;
  freshnessLabel: string;
  fulfillmentWindows: FulfillmentWindow[];
  allergenOptions: Array<{ id: string; label: string }>;
  products: Product[];
};

export type CartQuantities = Record<string, number>;

export function formatMoney(money: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency
  }).format(money.amountMinor / 100);
}
