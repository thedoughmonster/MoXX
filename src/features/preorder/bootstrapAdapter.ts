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
  const allergenIds = new Set<Product['allergens'][number]>();
  const products = data.catalog.map((item, index): Product => {
    item.allergens.forEach((allergen) => allergenIds.add(allergen));
    return {
      id: item.item_id,
      itemVersion: item.item_version,
      name: item.name,
      description: item.description,
      price: {
        currency: item.base_price.currency,
        amountMinor: item.base_price.amount_minor
      },
      art: artStyles[index % artStyles.length] ?? 'vanilla',
      badge: item.seasonal_eligibility === 'eligible' ? undefined : 'Not in season',
      allergens: item.allergens,
      allergenStatus: item.allergen_status === 'verified' ? 'verified' : 'unverified',
      maximumQuantity: item.available ? item.maximum_quantity : 0
    };
  });

  return {
    source: 'live',
    surfaceId: data.surface_id,
    locationId: data.location_id,
    versions: data.versions,
    surfaceName: 'Weekend preorder',
    locationName: data.location_name,
    freshnessLabel: `Updated ${new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: data.timezone
    }).format(new Date(data.fresh_at))}`,
    cancellationPolicy: {
      summary: data.cancellation_policy.summary,
      customerCancellationAllowed:
        data.cancellation_policy.customer_cancellation_allowed,
      customerModificationAllowed:
        data.cancellation_policy.customer_modification_allowed
    },
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
      label: id.split('_').map((part) =>
        part[0]?.toUpperCase() + part.slice(1)
      ).join(' ')
    })),
    products
  };
}
