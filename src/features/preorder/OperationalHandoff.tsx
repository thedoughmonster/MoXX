type OperationalHandoffProps = {
  checkoutUrl: string | null;
};

export function OperationalHandoff({ checkoutUrl }: OperationalHandoffProps) {
  return (
    <div className="handoff-page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Dough Monster preorder home">
          <span className="brand-mark" aria-hidden="true">DM</span>
          <span>
            <strong>Dough Monster</strong>
            <small>Order ahead</small>
          </span>
        </a>
        <div className="header-meta" aria-label="Online ordering available">
          <span className="open-dot" aria-hidden="true" />
          <span>Online ordering available</span>
        </div>
      </header>

      <main className="handoff-main">
        <section className="handoff-card" aria-labelledby="handoff-title">
          <span className="eyebrow">Fresh from Berwick</span>
          <h1 id="handoff-title">Your Dough Monster order starts here.</h1>
          <p>
            Choose doughnuts, drinks, breakfast, and a pickup time in our secure
            ordering checkout. Your order goes directly to the shop.
          </p>
          {checkoutUrl ? (
            <a className="primary-button handoff-button" href={checkoutUrl}>
              Start your order
            </a>
          ) : (
            <div className="handoff-unavailable" role="alert">
              Online ordering is temporarily unavailable. Please call the shop
              at <a href="tel:+15705202775">(570) 520-2775</a>.
            </div>
          )}
          <div className="handoff-details" aria-label="Order details">
            <span><strong>Pickup</strong>230 W Front Street, Berwick</span>
            <span><strong>Checkout</strong>Securely powered by Toast</span>
          </div>
        </section>
      </main>

      <footer>
        <strong>Dough Monster</strong>
        <span>Small batches. Big feelings.</span>
      </footer>
    </div>
  );
}
