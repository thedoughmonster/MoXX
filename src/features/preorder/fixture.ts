import { type PreorderFixture } from './model';

export const preorderFixture: PreorderFixture = {
  source: 'fixture',
  surfaceName: 'Weekend preorder',
  locationName: 'Dough Monster · Long Beach',
  freshnessLabel: 'Menu updated just now',
  fulfillmentWindows: [
    {
      id: 'saturday-august-1',
      eyebrow: 'Soonest',
      day: 'Saturday',
      date: 'Aug 1',
      time: '9:00–10:00 AM',
      availability: 'limited'
    },
    {
      id: 'sunday-august-2',
      eyebrow: 'More room',
      day: 'Sunday',
      date: 'Aug 2',
      time: '9:00–10:00 AM',
      availability: 'available'
    },
    {
      id: 'saturday-august-8',
      eyebrow: 'Plan ahead',
      day: 'Saturday',
      date: 'Aug 8',
      time: '9:00–10:00 AM',
      availability: 'available'
    }
  ],
  allergenOptions: [
    { id: 'milk', label: 'Milk' },
    { id: 'egg', label: 'Egg' },
    { id: 'peanut', label: 'Peanuts' },
    { id: 'tree-nut', label: 'Tree nuts' },
    { id: 'wheat', label: 'Wheat' },
    { id: 'soy', label: 'Soy' },
    { id: 'sesame', label: 'Sesame' }
  ],
  products: [
    {
      id: 'strawberry-cloud',
      name: 'Strawberry Cloud',
      description: 'Bright berry glaze, vanilla bean, and a soft sugar finish.',
      price: { currency: 'USD', amountMinor: 450 },
      art: 'berry',
      badge: 'Weekend favorite',
      allergens: ['milk', 'egg', 'wheat'],
      allergenStatus: 'verified',
      maximumQuantity: 12
    },
    {
      id: 'dark-chocolate-sea-salt',
      name: 'Dark Chocolate + Sea Salt',
      description: 'Deep cocoa glaze with flaky salt and a tender ring.',
      price: { currency: 'USD', amountMinor: 475 },
      art: 'chocolate',
      allergens: ['milk', 'egg', 'wheat', 'soy'],
      allergenStatus: 'verified',
      maximumQuantity: 8
    },
    {
      id: 'lemon-sunbeam',
      name: 'Lemon Sunbeam',
      description: 'Lemon curd, citrus sugar, and a little California sunshine.',
      price: { currency: 'USD', amountMinor: 500 },
      art: 'citrus',
      badge: 'Seasonal',
      allergens: ['milk', 'egg', 'wheat'],
      allergenStatus: 'verified',
      maximumQuantity: 6
    },
    {
      id: 'vanilla-mystery',
      name: 'Vanilla Bean Twist',
      description: 'A delicate twist awaiting its final allergen verification.',
      price: { currency: 'USD', amountMinor: 425 },
      art: 'vanilla',
      allergens: [],
      allergenStatus: 'unverified',
      maximumQuantity: 0
    }
  ]
};

export async function loadPreorderFixture(): Promise<PreorderFixture> {
  return preorderFixture;
}
