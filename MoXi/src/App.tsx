import { PreorderExperience } from './features/preorder/PreorderExperience';
import { SquareWebPaymentsBoundary } from './integrations/square-web-payments';
import { OperationalHandoff } from './features/preorder/OperationalHandoff';
import { preorderCheckoutUrl, preorderExperienceMode } from './lib/config';

export function App() {
  return (
    <SquareWebPaymentsBoundary>
      {preorderExperienceMode === 'toast_handoff'
        ? <OperationalHandoff checkoutUrl={preorderCheckoutUrl} />
        : <PreorderExperience />}
    </SquareWebPaymentsBoundary>
  );
}
