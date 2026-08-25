import { describe, expect, test } from 'vitest';
import { type PreorderBootstrapEnvelope } from '../../lib/contracts';
import { adaptBootstrap } from './bootstrapAdapter';

const envelope: PreorderBootstrapEnvelope = {
  meta: {
    contract_key: 'momi.preorder.bootstrap.read.v1',
    request_id: '10000000-0000-4000-8000-000000000001',
    generated_at: '2026-08-05T12:00:00Z'
  },
  data: {
    surface_id: '10000000-0000-4000-8000-000000000002',
    surface_key: 'preorder',
    location_id: '9154e81d-52a1-46ea-a213-e572343a601b',
    location_name: 'Dough Monster',
    timezone: 'America/New_York',
    versions: {
      surface_version: 3,
      catalog_version: 3,
      policy_version: 3,
      mapping_version: 3
    },
    fulfillment_windows: [{
      window_id: '10000000-0000-4000-8000-000000000004',
      date: '2026-08-08',
      starts_at: '2026-08-08T08:00:00-04:00',
      ends_at: '2026-08-08T14:00:00-04:00',
      order_cutoff_at: '2026-08-07T17:00:00-04:00',
      availability: 'available'
    }],
    catalog: [{
      item_id: '10000000-0000-4000-8000-000000000005',
      item_version: 3,
      category: 'classic',
      name: 'Test Doughnut',
      description: 'Synthetic adapter fixture.',
      base_price: { currency: 'USD', amount_minor: 150 },
      shop_price: { currency: 'USD', amount_minor: 250 },
      price_floor: { currency: 'USD', amount_minor: 150 },
      media: [],
      allergen_status: 'verified',
      allergens: ['milk', 'wheat'],
      seasonal_eligibility: 'eligible',
      available: true,
      maximum_quantity: 8,
      option_groups: [],
      disclosures: []
    }],
    cancellation_policy: {
      summary: 'Contact the shop by 5 PM the prior day.',
      customer_cancellation_allowed: false,
      customer_modification_allowed: false
    },
    fresh_at: '2026-08-05T12:00:00Z',
    expires_at: '2026-08-05T12:05:00Z'
  }
};

describe('preorder bootstrap adapter', () => {
  test('maps accepted v3 fields into the live selection model', () => {
    const result = adaptBootstrap(envelope);

    expect(result.source).toBe('live');
    expect(result.surfaceId).toBe(envelope.data.surface_id);
    expect(result.locationId).toBe(envelope.data.location_id);
    expect(result.versions).toEqual(envelope.data.versions);
    expect(result.fulfillmentWindows[0]?.availability).toBe('available');
    expect(result.products[0]?.itemVersion).toBe(3);
    expect(result.products[0]?.allergens).toEqual(['milk', 'wheat']);
    expect(result.products[0]?.allergenStatus).toBe('verified');
    expect(result.allergenOptions.map((item) => item.label)).toEqual(['Milk', 'Wheat']);
    expect(result.cancellationPolicy).toEqual({
      summary: 'Contact the shop by 5 PM the prior day.',
      customerCancellationAllowed: false,
      customerModificationAllowed: false
    });
  });

  test('keeps general ordering available when allergen data is unverified', () => {
    const unverified = structuredClone(envelope);
    unverified.data.catalog[0]!.allergen_status = 'unverified';
    unverified.data.catalog[0]!.allergens = [];

    const product = adaptBootstrap(unverified).products[0];
    expect(product?.allergenStatus).toBe('unverified');
    expect(product?.maximumQuantity).toBe(8);
  });
});
