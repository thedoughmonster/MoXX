import { z } from 'zod';
import { type Allergen } from '../../lib/contracts';
import { type CartQuantities, type PreorderFixture } from './model';

const DRAFT_KEY = 'moxi.preorder.draft.v1';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const storedAllergen = z.enum([
  'milk',
  'egg',
  'peanuts',
  'tree_nuts',
  'wheat',
  'soy',
  'sesame'
]);

export const customerDetailsSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the pickup name.').max(100),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  phone: z.string().trim()
    .regex(/^[+()\-\s0-9]{7,24}$/, 'Enter a valid phone number.'),
  pickupNotes: z.string().trim().max(240, 'Keep pickup notes under 240 characters.')
});

export type CustomerDetails = z.infer<typeof customerDetailsSchema>;

const storedCustomerDetailsSchema = z.object({
  fullName: z.string().max(100),
  email: z.string().max(254),
  phone: z.string().max(24),
  pickupNotes: z.string().max(240)
});

const storedDraftSchema = z.object({
  version: z.literal(1),
  savedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  selectedWindow: z.string().max(120),
  selectedAllergens: z.array(storedAllergen).max(7),
  quantities: z.record(z.string().max(120), z.number().int().min(0).max(100)),
  customerDetails: storedCustomerDetailsSchema
});

export type RecoverableDraft = z.infer<typeof storedDraftSchema>;

export const emptyCustomerDetails: CustomerDetails = {
  fullName: '',
  email: '',
  phone: '',
  pickupNotes: ''
};

export function loadRecoverableDraft(): RecoverableDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = storedDraftSchema.parse(JSON.parse(raw));
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

export function clearRecoverableDraft(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DRAFT_KEY);
  }
}

export function revalidateRecoveredDraft(
  draft: RecoverableDraft,
  data: PreorderFixture
): {
  selectedWindow: string;
  selectedAllergens: Allergen[];
  quantities: CartQuantities;
  adjusted: boolean;
} {
  const selectableWindows = data.fulfillmentWindows.filter(
    (window) => window.availability === 'available' || window.availability === 'limited'
  );
  const selectedWindow = selectableWindows.some((window) => window.id === draft.selectedWindow)
    ? draft.selectedWindow
    : selectableWindows[0]?.id ?? '';
  const knownAllergens = new Set(data.allergenOptions.map((allergen) => allergen.id));
  const selectedAllergens = draft.selectedAllergens.filter((id) => knownAllergens.has(id));
  const quantities: CartQuantities = {};
  for (const product of data.products) {
    const requested = draft.quantities[product.id] ?? 0;
    const conflicts = product.allergens.some((id) => selectedAllergens.includes(id));
    const lacksRequestedEvidence =
      selectedAllergens.length > 0 && product.allergenStatus !== 'verified';
    const maximum = !lacksRequestedEvidence && !conflicts
      ? product.maximumQuantity
      : 0;
    const accepted = Math.max(0, Math.min(requested, maximum));
    if (accepted > 0) quantities[product.id] = accepted;
  }
  const beforeQuantities = Object.fromEntries(
    Object.entries(draft.quantities).filter(([, quantity]) => quantity > 0)
  );
  return {
    selectedWindow,
    selectedAllergens,
    quantities,
    adjusted: selectedWindow !== draft.selectedWindow
      || selectedAllergens.length !== draft.selectedAllergens.length
      || JSON.stringify(quantities) !== JSON.stringify(beforeQuantities)
  };
}

export function saveRecoverableDraft(input: {
  selectedWindow: string;
  selectedAllergens: Allergen[];
  quantities: CartQuantities;
  customerDetails: CustomerDetails;
}): void {
  if (typeof window === 'undefined') return;
  const hasContent = Object.values(input.quantities).some((quantity) => quantity > 0)
    || input.selectedAllergens.length > 0
    || Object.values(input.customerDetails).some((value) => value.trim().length > 0);
  if (!hasContent) {
    window.localStorage.removeItem(DRAFT_KEY);
    return;
  }
  const savedAt = new Date();
  const draft: RecoverableDraft = {
    version: 1,
    savedAt: savedAt.toISOString(),
    expiresAt: new Date(savedAt.getTime() + DRAFT_TTL_MS).toISOString(),
    ...input
  };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
