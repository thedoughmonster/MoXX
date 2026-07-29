import { type PreorderBootstrapEnvelope } from '../../lib/contracts';
import { type PreorderFixture, type Product } from './model';

const artStyles: Product['art'][] = ['berry', 'chocolate', 'citrus', 'vanilla'];

function formatWindowTime(startsAt: string, endsAt: string, timezone: string): string {
  const format = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone
  });
  return `${format.format(new Date(startsAt))}–${format.format(new Date(endsAt))}`;
}

export function adaptBootstrap(envelope: PreorderBootstrapEnvelope): PreorderFixture {
  const { data } = envelope;
  const allergenIds = new Set<string>();
  const products = data.catalog.map((item, index): Product => {
    const allergens = item.allergens ?? [];
    allergens.forEach((allergen) => allergenIds.add(allergen));
    const missingDeclaredAllergens = item.allergen_status !== 'verified'
      && item.allergens === undefined;
    return {
      id: item.item_id,
      name: item.name,
      description: item.description,
      price: {
        currency: item.base_price.currency,
        amountMinor: item.base_price.amount_minor
      },
      art: artStyles[index % artStyles.length] ?? 'vanilla',
      badge: item.seasonal_eligibility === 'eligible' ? undefined : 'Not in season',
      allergens,
      allergenStatus: item.allergen_status === 'unverified' || missingDeclaredAllergens
        ? 'unverified'
        : 'verified',
      maximumQuantity: item.available ? item.maximum_quantity : 0
    };
  });

  return {
    source: 'live',
    surfaceName: 'Weekend preorder',
    locationName: data.location_name,
    freshnessLabel: `Updated ${new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: data.timezone
    }).format(new Date(data.fresh_at))}`,
    fulfillmentWindows: data.fulfillment_windows.map((window, index) => ({
      id: window.window_id,
      eyebrow: index === 0 ? 'Soonest' : 'Plan ahead',
      day: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: data.timezone
      }).format(new Date(window.starts_at)),
      date: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: data.timezone
      }).format(new Date(window.starts_at)),
      time: formatWindowTime(window.starts_at, window.ends_at, data.timezone),
      availability: window.availability
    })),
    allergenOptions: [...allergenIds].sort().map((id) => ({
      id,
      label: id.split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ')
    })),
    products
  };
}
