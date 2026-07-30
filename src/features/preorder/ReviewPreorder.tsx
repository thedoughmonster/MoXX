import { Button } from 'react-aria-components';
import { type CustomerDetails } from './draft';
import {
  type CartQuantities,
  type Product,
  formatMoney
} from './model';

type ReviewPreorderProps = {
  customerDetails: CustomerDetails;
  pickupLabel: string;
  products: Product[];
  quantities: CartQuantities;
  onEditDetails: () => void;
  onKeepShopping: () => void;
};

export function ReviewPreorder({
  customerDetails,
  pickupLabel,
  products,
  quantities,
  onEditDetails,
  onKeepShopping
}: ReviewPreorderProps) {
  const lines = products
    .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
    .filter((line) => line.quantity > 0);
  const subtotalMinor = lines.reduce(
    (sum, line) => sum + line.product.price.amountMinor * line.quantity,
    0
  );

  return (
    <main className="flow-page">
      <div className="flow-card review-card">
        <span className="eyebrow">Step 3 of 4</span>
        <h1>Review your preorder</h1>
        <div className="quote-warning" role="status">
          <strong>Fresh authoritative quote required</strong>
          <span>
            Placeholder prices, savings, taxes, capacity, and policy cannot be
            accepted or paid. This preview remains read-only.
          </span>
        </div>

        <section className="review-section" aria-labelledby="review-pickup">
          <div className="review-heading">
            <h2 id="review-pickup">Pickup</h2>
            <Button className="text-button" onPress={onKeepShopping}>Change</Button>
          </div>
          <p>{pickupLabel}</p>
        </section>

        <section className="review-section" aria-labelledby="review-items">
          <div className="review-heading">
            <h2 id="review-items">Your box</h2>
            <Button className="text-button" onPress={onKeepShopping}>Edit</Button>
          </div>
          <ul className="review-lines">
            {lines.map(({ product, quantity }) => (
              <li key={product.id}>
                <span>
                  <strong>{quantity}× {product.name}</strong>
                  <small>
                    {product.allergenStatus === 'verified'
                      ? `Declared allergens: ${product.allergens.join(', ') || 'none'}`
                      : 'Allergen evidence is not verified'}
                  </small>
                </span>
                <strong>{formatMoney({
                  currency: product.price.currency,
                  amountMinor: product.price.amountMinor * quantity
                })}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="review-section" aria-labelledby="review-contact">
          <div className="review-heading">
            <h2 id="review-contact">Pickup contact</h2>
            <Button className="text-button" onPress={onEditDetails}>Edit</Button>
          </div>
          <address>
            <strong>{customerDetails.fullName}</strong>
            <span>{customerDetails.email}</span>
            <span>{customerDetails.phone}</span>
            {customerDetails.pickupNotes && <span>{customerDetails.pickupNotes}</span>}
          </address>
        </section>

        <section className="review-section totals-section" aria-labelledby="review-total">
          <h2 id="review-total">Quote status</h2>
          <dl>
            <div><dt>Draft subtotal</dt><dd>{formatMoney({ currency: 'USD', amountMinor: subtotalMinor })}</dd></div>
            <div><dt>Savings</dt><dd>Pending fresh quote</dd></div>
            <div><dt>Taxes and fees</dt><dd>Pending fresh quote</dd></div>
            <div><dt>Authoritative total</dt><dd>Not quoted</dd></div>
            <div><dt>Quote expiry</dt><dd>Not issued</dd></div>
          </dl>
        </section>

        <section className="policy-placeholder" aria-labelledby="policy-heading">
          <h2 id="policy-heading">Pickup and cancellation policy</h2>
          <p>
            Final cancellation, modification, no-show, and allergen disclosures
            are pending acceptance and must be shown before ordering is enabled.
          </p>
        </section>

        <div className="flow-actions">
          <Button className="secondary-button" onPress={onEditDetails}>← Edit details</Button>
          <Button className="primary-button" isDisabled>Ordering remains disabled</Button>
        </div>
      </div>
    </main>
  );
}
