import { PreorderExperience } from './features/preorder/PreorderExperience';
import { SquareWebPaymentsBoundary } from './integrations/square-web-payments';
import { OperationalHandoff } from './features/preorder/OperationalHandoff';
import { preorderCheckoutUrl, preorderExperienceMode } from './lib/config';
import { CHECKOUT_PATH, readCheckoutHandoff } from './features/checkout/client';
import {
  checkoutFixtureHandoff,
  createFixtureCheckoutClient,
  readFixtureScenario
} from './features/checkout/fixtures';
import { NeutralCheckout } from './features/checkout/NeutralCheckout';

export function App() {
  if (window.location.pathname === CHECKOUT_PATH) {
    const fixtureScenario = readFixtureScenario(window.location.search);
    const handoff = readCheckoutHandoff(window.location.search)
      ?? (import.meta.env.DEV ? checkoutFixtureHandoff : null);
    return (
      <NeutralCheckout
        client={createFixtureCheckoutClient(fixtureScenario)}
        handoff={handoff}
      />
    );
  }

  return (
    <SquareWebPaymentsBoundary>
      {preorderExperienceMode === 'toast_handoff'
        ? <OperationalHandoff checkoutUrl={preorderCheckoutUrl} />
        : <PreorderExperience />}
    </SquareWebPaymentsBoundary>
  );
}
