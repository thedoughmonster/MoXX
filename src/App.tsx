import { PreorderExperience } from './features/preorder/PreorderExperience';
import { OperationalHandoff } from './features/preorder/OperationalHandoff';
import { preorderCheckoutUrl, preorderExperienceMode } from './lib/config';

export function App() {
  if (preorderExperienceMode === 'toast_handoff') {
    return <OperationalHandoff checkoutUrl={preorderCheckoutUrl} />;
  }
  return <PreorderExperience />;
}
