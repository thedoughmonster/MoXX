import { describe, expect, test } from 'vitest';
import { customerDetailsSchema, emptyCustomerDetails } from './draft';

describe('preorder customer details', () => {
  test('keeps only contact fields supported by canonical checkout', () => {
    const details = customerDetailsSchema.parse({
      fullName: 'Synthetic Customer',
      email: 'synthetic@example.invalid',
      phone: '+1 555 010 0200',
      pickupNotes: 'This legacy draft value must not reach review.'
    });

    expect(details).toEqual({
      fullName: 'Synthetic Customer',
      email: 'synthetic@example.invalid',
      phone: '+1 555 010 0200'
    });
    expect(emptyCustomerDetails).not.toHaveProperty('pickupNotes');
  });
});
