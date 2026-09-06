import { PreorderExperience } from './features/preorder/PreorderExperience';
import { SquareWebPaymentsBoundary } from './integrations/square-web-payments';
import { OperationalHandoff } from './features/preorder/OperationalHandoff';
import { preorderCheckoutUrl, preorderExperienceMode } from './lib/config';
import {
  CHECKOUT_PATH,
  CHECKOUT_REFERENCE_PATH,
  readCheckoutHandoff
} from './features/checkout/client';
import {
  checkoutFixtureHandoff,
  createFixtureCheckoutClient,
  readFixtureFailure,
  readFixtureScenario
} from './features/checkout/fixtures';
import { NeutralCheckout } from './features/checkout/NeutralCheckout';

export function App() {
  if (window.location.pathname === CHECKOUT_REFERENCE_PATH) {
    const fixtureScenario = readFixtureScenario(window.location.search);
    return (
      <NeutralCheckout
        client={createFixtureCheckoutClient(
          fixtureScenario,
          readFixtureFailure(window.location.search)
        )}
        handoff={checkoutFixtureHandoff}
      />
    );
  }

  if (window.location.pathname === CHECKOUT_PATH) {
    return (
      <NeutralCheckout
        client={null}
        handoff={readCheckoutHandoff(window.location.search)}
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
