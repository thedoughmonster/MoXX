import { Button } from 'react-aria-components';
import { type Product, formatMoney } from './model';

type ProductCardProps = {
  product: Product;
  quantity: number;
  blockedBy: string[];
  onDecrease: () => void;
  onIncrease: () => void;
};

export function ProductCard({
  product,
  quantity,
  blockedBy,
  onDecrease,
  onIncrease
}: ProductCardProps) {
  const unverified = product.allergenStatus === 'unverified';
  const unavailable = unverified || blockedBy.length > 0;
  const reason = unverified
    ? 'Allergen details are still being verified'
    : blockedBy.length > 0
      ? 'Contains ' + blockedBy.join(', ')
      : null;

  return (
    <article className={'product-card' + (unavailable ? ' is-unavailable' : '')}>
      <div className={'product-art art-' + product.art} aria-hidden="true">
        <span className="doughnut-shape" />
      </div>
      <div className="product-body">
        <div className="product-heading">
          <div>
            {product.badge && <span className="product-badge">{product.badge}</span>}
            <h3>{product.name}</h3>
          </div>
          <strong>{formatMoney(product.price)}</strong>
        </div>
        <p>{product.description}</p>
        {reason && (
          <p className="availability-note" role="status">
            <span aria-hidden="true">!</span>
            {reason}
          </p>
        )}
        <div className="quantity-row">
          <span className="quantity-label">
            {unavailable ? 'Unavailable' : quantity === 0 ? 'Choose quantity' : 'In your box'}
          </span>
          <div className="stepper" aria-label={'Quantity for ' + product.name}>
            <Button
              className="stepper-button"
              aria-label={'Remove one ' + product.name}
              isDisabled={quantity === 0}
              onPress={onDecrease}
            >
              −
            </Button>
            <output aria-live="polite" aria-label={String(quantity) + ' selected'}>
              {quantity}
            </output>
            <Button
              className="stepper-button stepper-add"
              aria-label={'Add one ' + product.name}
              isDisabled={unavailable || quantity >= product.maximumQuantity}
              onPress={onIncrease}
            >
              +
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
