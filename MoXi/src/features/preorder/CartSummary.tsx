import { Button } from 'react-aria-components';
import {
  type CartQuantities,
  type Product,
  formatMoney
} from './model';

type CartSummaryProps = {
  products: Product[];
  quantities: CartQuantities;
  pickupLabel: string;
  onReview: () => void;
};

export function CartSummary({
  products,
  quantities,
  pickupLabel,
  onReview
}: CartSummaryProps) {
  const selected = products
    .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
    .filter((line) => line.quantity > 0);
  const itemCount = selected.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalMinor = selected.reduce(
    (sum, line) => sum + line.product.price.amountMinor * line.quantity,
    0
  );
  const nextSavings = Math.max(0, 6 - itemCount);

  return (
    <aside className="cart-summary" aria-labelledby="cart-title">
      <div className="cart-topline">
        <div>
          <span className="eyebrow">Your preorder</span>
          <h2 id="cart-title">
            {itemCount === 0
              ? 'Start your box'
              : String(itemCount) + (itemCount === 1 ? ' doughnut' : ' doughnuts')}
          </h2>
        </div>
        {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
      </div>

      <p className="pickup-summary">
        <span aria-hidden="true">↗</span>
        {pickupLabel}
      </p>

      {selected.length === 0 ? (
        <div className="empty-cart">
          <span className="mini-doughnut" aria-hidden="true" />
          <p>Add something wonderful. Your order summary will stay right here.</p>
        </div>
      ) : (
        <ul className="cart-lines">
          {selected.map(({ product, quantity }) => (
            <li key={product.id}>
              <span>{quantity}× {product.name}</span>
              <strong>
                {formatMoney({
                  currency: 'USD',
                  amountMinor: product.price.amountMinor * quantity
                })}
              </strong>
            </li>
          ))}
        </ul>
      )}

      <div className="savings-card">
        <div className="savings-heading">
          <span>Box power</span>
          <strong>
            {nextSavings === 0 ? 'Unlocked' : String(nextSavings) + ' to savings'}
          </strong>
        </div>
        <div
          className="power-track"
          aria-label={String(Math.min(itemCount, 6)) + ' of 6 toward savings'}
        >
          <span style={{ width: String(Math.min(100, (itemCount / 6) * 100)) + '%' }} />
        </div>
        <p>The final savings and total come from your fresh quote.</p>
      </div>

      <div className="subtotal-row">
        <span>Draft subtotal</span>
        <strong>{formatMoney({ currency: 'USD', amountMinor: subtotalMinor })}</strong>
      </div>
      <p className="quote-note">Taxes, savings, and availability are confirmed at review.</p>
      <Button
        className="primary-button"
        isDisabled={itemCount === 0}
        onPress={onReview}
      >
        Review preorder
        <span aria-hidden="true">→</span>
      </Button>
    </aside>
  );
}
