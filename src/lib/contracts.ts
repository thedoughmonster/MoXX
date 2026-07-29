import { z } from 'zod';

const stableKey = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/);

const fulfillmentWindow = z.object({
  window_id: z.string().uuid(),
  date: z.iso.date(),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  order_cutoff_at: z.iso.datetime({ offset: true }),
  availability: z.enum(['available', 'limited', 'closed', 'sold_out'])
});

const catalogItem = z.object({
  item_id: z.string().uuid(),
  item_version: z.number().int().positive(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000),
  base_price: z.object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount_minor: z.number().int().nonnegative()
  }),
  media: z.array(z.object({ url: z.url(), alt: z.string().max(240) })),
  allergen_status: z.enum([
    'verified',
    'contains_declared',
    'cross_contact_possible',
    'unverified'
  ]),
  allergens: z.array(stableKey).optional(),
  seasonal_eligibility: z.enum(['eligible', 'ineligible']),
  available: z.boolean(),
  maximum_quantity: z.number().int().nonnegative(),
  option_groups: z.array(z.unknown()),
  disclosures: z.array(z.string().max(240))
});

export const preorderBootstrapEnvelope = z.object({
  meta: z.object({
    contract_key: z.literal('momi.preorder.bootstrap.read.v1'),
    request_id: z.string().uuid(),
    generated_at: z.iso.datetime({ offset: true })
  }),
  data: z.object({
    surface_id: z.string().uuid(),
    surface_key: stableKey,
    location_id: z.string().uuid(),
    location_name: z.string().min(1).max(120),
    timezone: z.string().min(1).max(64),
    fulfillment_windows: z.array(fulfillmentWindow),
    catalog: z.array(catalogItem),
    fresh_at: z.iso.datetime({ offset: true }),
    expires_at: z.iso.datetime({ offset: true })
  })
});

export type PreorderBootstrapEnvelope = z.infer<typeof preorderBootstrapEnvelope>;
