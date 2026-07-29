import { describe, expect, test } from 'vitest';
import { type PreorderBootstrapEnvelope } from '../../lib/contracts';
import { adaptBootstrap } from './bootstrapAdapter';

const envelope: PreorderBootstrapEnvelope = {
  meta: {
    contract_key: 'momi.preorder.bootstrap.read.v1',
    request_id: '10000000-0000-4000-8000-000000000001',
    generated_at: '2026-07-29T12:00:00Z'
  },
  data: {
    surface_id: '10000000-0000-4000-8000-000000000002',
    surface_key: 'preorder',
    location_id: '10000000-0000-4000-8000-000000000003',
    location_name: 'Dough Monster',
    timezone: 'America/Los_Angeles',
    fulfillment_windows: [{
      window_id: '10000000-0000-4000-8000-000000000004',
      date: '2026-08-01',
      starts_at: '2026-08-01T09:00:00-07:00',
      ends_at: '2026-08-01T10:00:00-07:00',
      order_cutoff_at: '2026-07-31T12:00:00-07:00',
      availability: 'available'
    }],
    catalog: [{
      item_id: '10000000-0000-4000-8000-000000000005',
      item_version: 1,
      name: 'Test Doughnut',
      description: 'Synthetic adapter fixture.',
      base_price: { currency: 'USD', amount_minor: 450 },
      media: [],
      allergen_status: 'contains_declared',
      allergens: ['milk', 'wheat'],
      seasonal_eligibility: 'eligible',
      available: true,
      maximum_quantity: 8,
      option_groups: [],
      disclosures: []
    }],
    fresh_at: '2026-07-29T12:00:00Z',
    expires_at: '2026-07-29T12:05:00Z'
  }
};

describe('preorder bootstrap adapter', () => {
  test('maps accepted live fields into the selection model', () => {
    const result = adaptBootstrap(envelope);
    expect(result.source).toBe('live');
    expect(result.fulfillmentWindows[0]?.availability).toBe('available');
    expect(result.products[0]?.allergens).toEqual(['milk', 'wheat']);
    expect(result.allergenOptions.map((item) => item.label)).toEqual(['Milk', 'Wheat']);
  });

  test('fails closed when declared allergen details are absent', () => {
    const withoutDetails = structuredClone(envelope);
    delete withoutDetails.data.catalog[0]!.allergens;
    expect(adaptBootstrap(withoutDetails).products[0]?.allergenStatus).toBe('unverified');
  });
});
