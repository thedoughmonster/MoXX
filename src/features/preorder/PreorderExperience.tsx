import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMachine } from '@xstate/react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup
} from 'react-aria-components';
import { type Allergen } from '../../lib/contracts';
import { PreorderApiError } from '../../lib/api';
import { preorderDataMode } from '../../lib/config';
import { CartSummary } from './CartSummary';
import { CustomerDetailsStep } from './CustomerDetailsStep';
import {
  clearRecoverableDraft,
  emptyCustomerDetails,
  loadRecoverableDraft,
  revalidateRecoveredDraft,
  saveRecoverableDraft,
  type RecoverableDraft
} from './draft';
import { loadPreorder } from './loadPreorder';
import { type CartQuantities, type PreorderFixture } from './model';
import { preorderMachine } from './preorderMachine';
import { ProductCard } from './ProductCard';
import { ReviewPreorder } from './ReviewPreorder';

export function PreorderExperience() {
  const [recoveredDraft] = useState(loadRecoverableDraft);
  const { data, error, refetch, status } = useQuery({
    queryKey: ['preorder-bootstrap', preorderDataMode],
    queryFn: loadPreorder
  });

  if (status === 'pending') {
    return <PreorderSkeleton />;
  }

  if (status === 'error' || !data) {
    const unpublished = error instanceof PreorderApiError && error.status === 409;
    return (
      <main className="state-page">
        <span className="brand-mark" aria-hidden="true">DM</span>
        <h1>{unpublished ? 'Preorders aren’t open yet.' : 'We couldn’t open preorders.'}</h1>
        <p>
          {unpublished
            ? 'The service is connected, but no preorder menu has been published.'
            : 'Your cart is safe. Please try again in a moment.'}
        </p>
        <Button className="primary-button" onPress={() => void refetch()}>
          Check again
        </Button>
      </main>
    );
  }

  return <LoadedPreorderExperience data={data} recoveredDraft={recoveredDraft} />;
}

function LoadedPreorderExperience({
  data,
  recoveredDraft
}: {
  data: PreorderFixture;
  recoveredDraft: RecoverableDraft | null;
}) {
  const initialDraft = useMemo(
    () => recoveredDraft ? revalidateRecoveredDraft(recoveredDraft, data) : null,
    [data, recoveredDraft]
  );
  const [selectedWindow, setSelectedWindow] = useState(
    initialDraft?.selectedWindow ?? 'saturday-august-1'
  );
  const [selectedAllergens, setSelectedAllergens] = useState<Allergen[]>(
    initialDraft?.selectedAllergens ?? []
  );
  const [quantities, setQuantities] = useState<CartQuantities>(
    initialDraft?.quantities ?? {}
  );
  const [customerDetails, setCustomerDetails] = useState(
    recoveredDraft?.customerDetails ?? emptyCustomerDetails
  );
  const [draftStatus, setDraftStatus] = useState<'validated' | 'adjusted' | null>(
    initialDraft ? (initialDraft.adjusted ? 'adjusted' : 'validated') : null
  );
  const [flow, send] = useMachine(preorderMachine);

  const allergenLabels = useMemo(
    () => new Map(data?.allergenOptions.map((item) => [item.id, item.label]) ?? []),
    [data]
  );

  useEffect(() => {
    saveRecoverableDraft({
      selectedWindow,
      selectedAllergens,
      quantities,
      customerDetails
    });
  }, [customerDetails, quantities, selectedAllergens, selectedWindow]);

  const selectableWindows = data.fulfillmentWindows.filter(
    (item) => item.availability === 'available' || item.availability === 'limited'
  );
  const selectedPickupWindow = selectableWindows.find(
    (item) => item.id === selectedWindow
  )
    ?? selectableWindows[0];
  const effectiveSelectedWindow = selectedPickupWindow?.id ?? '';
  const pickupLabel = selectedPickupWindow
    ? selectedPickupWindow.day + ', ' + selectedPickupWindow.date + ' · '
      + selectedPickupWindow.time
    : 'Choose a pickup window';

  const changeQuantity = (productId: string, delta: number) => {
    const product = data.products.find((item) => item.id === productId);
    if (!product) return;
    setQuantities((current) => {
      const next = Math.max(
        0,
        Math.min(product.maximumQuantity, (current[productId] ?? 0) + delta)
      );
      return { ...current, [productId]: next };
    });
  };

  if (flow.matches('details')) {
    return (
      <CustomerDetailsStep
        initialDetails={customerDetails}
        pickupLabel={pickupLabel}
        onBack={() => send({ type: 'KEEP_SHOPPING' })}
        onDraftChange={setCustomerDetails}
        onContinue={(details) => {
          setCustomerDetails(details);
          send({ type: 'REVIEW' });
        }}
      />
    );
  }

  if (flow.matches('reviewing')) {
    return (
      <ReviewPreorder
        customerDetails={customerDetails}
        data={data}
        pickupLabel={pickupLabel}
        products={data.products}
        quantities={quantities}
        selectedAllergens={selectedAllergens}
        selectedWindow={effectiveSelectedWindow}
        onEditDetails={() => send({ type: 'EDIT_DETAILS' })}
        onKeepShopping={() => send({ type: 'KEEP_SHOPPING' })}
      />
    );
  }

  return (
    <div className="preorder-app">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Dough Monster preorder home">
          <span className="brand-mark" aria-hidden="true">DM</span>
          <span>
            <strong>Dough Monster</strong>
            <small>Weekend preorder</small>
          </span>
        </a>
        <div className="header-meta">
          <span className="open-dot" aria-hidden="true" />
          <span>{data.source === 'fixture' ? 'Preview only' : 'Preorders open'}</span>
        </div>
      </header>

      {data.source === 'fixture' && (
        <div className="preview-banner" role="status">
          Preview menu · Test data only · Ordering and payment are disabled
        </div>
      )}

      {draftStatus && (
        <div className="draft-restored" role="status">
          <span>
            {draftStatus === 'adjusted'
              ? 'Draft restored · Unavailable items or quantities were adjusted'
              : 'Draft restored and revalidated against the current preview menu'}
          </span>
          <Button
            className="quiet-button"
            onPress={() => {
              clearRecoverableDraft();
              setSelectedWindow(selectableWindows[0]?.id ?? '');
              setSelectedAllergens([]);
              setQuantities({});
              setCustomerDetails(emptyCustomerDetails);
              setDraftStatus(null);
            }}
          >
            Clear draft
          </Button>
        </div>
      )}

      <div className="progress-shell" aria-label="Preorder progress">
        <ol className="progress-list">
          <li className="is-current"><span>1</span>Choose</li>
          <li><span>2</span>Details</li>
          <li><span>3</span>Pay</li>
          <li><span>4</span>Done</li>
        </ol>
      </div>

      <main className="ordering-layout">
        <div className="ordering-main">
          <section className="hero" aria-labelledby="page-title">
            <span className="eyebrow">Made for your weekend</span>
            <h1 id="page-title">Pick your doughnuts.<br />We’ll make the morning.</h1>
            <p>
              Choose a pickup time first, then build a box from the flavors
              announced for that day.
            </p>
            <div className="location-chip">
              <span aria-hidden="true">⌖</span>
              <span>
                <small>Picking up at</small>
                <strong>{data.locationName}</strong>
              </span>
            </div>
          </section>

          <section className="order-section" aria-labelledby="pickup-heading">
            <div className="section-heading">
              <div>
                <span className="section-number">1</span>
                <div>
                  <h2 id="pickup-heading">When should we have it ready?</h2>
                  <p>Same-day ordering isn’t available.</p>
                </div>
              </div>
              <span className="freshness">{data.freshnessLabel}</span>
            </div>
            <RadioGroup
              className="date-grid"
              value={effectiveSelectedWindow}
              onChange={setSelectedWindow}
              aria-label="Pickup window"
            >
              {data.fulfillmentWindows.map((item) => (
                <Radio
                  className="date-card"
                  key={item.id}
                  value={item.id}
                  isDisabled={item.availability === 'closed' || item.availability === 'sold_out'}
                >
                  {({ isSelected }) => (
                    <>
                      <span className="date-eyebrow">{item.eyebrow}</span>
                      <strong>{item.day}</strong>
                      <span>{item.date} · {item.time}</span>
                      <span className={'availability availability-' + item.availability}>
                        {availabilityLabel(item.availability)}
                      </span>
                      <span className="radio-check" aria-hidden="true">
                        {isSelected ? '✓' : ''}
                      </span>
                    </>
                  )}
                </Radio>
              ))}
            </RadioGroup>
          </section>

          <section className="order-section" aria-labelledby="allergen-heading">
            <div className="section-heading">
              <div>
                <span className="section-number">2</span>
                <div>
                  <h2 id="allergen-heading">Anything you need to avoid?</h2>
                  <p>We’ll keep every announced flavor visible and explain what conflicts.</p>
                </div>
              </div>
              <Button className="text-button" onPress={() => setSelectedAllergens([])}>
                Clear all
              </Button>
            </div>
            {data.allergenOptions.length > 0 ? (
              <CheckboxGroup
                className="allergen-grid"
                value={selectedAllergens}
                onChange={(values) =>
                  setSelectedAllergens(
                    data.allergenOptions
                      .filter((option) => values.includes(option.id))
                      .map((option) => option.id)
                  )
                }
                aria-label="Allergens to avoid"
              >
                {data.allergenOptions.map((option) => (
                  <Checkbox className="allergen-chip" key={option.id} value={option.id}>
                    {({ isSelected }) => (
                      <>
                        <span className="chip-check" aria-hidden="true">
                          {isSelected ? '✓' : ''}
                        </span>
                        {option.label}
                      </>
                    )}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            ) : (
              <p className="cross-contact-note">
                Exact allergen filtering is unavailable for this menu.
              </p>
            )}
            <p className="cross-contact-note">
              <span aria-hidden="true">i</span>
              All doughnuts are made in a shared kitchen. Allergen information may
              be unverified, and avoidance requests remain unavailable without evidence.
            </p>
          </section>

          <section className="order-section menu-section" aria-labelledby="menu-heading">
            <div className="section-heading">
              <div>
                <span className="section-number">3</span>
                <div>
                  <h2 id="menu-heading">Build your box</h2>
                  <p>{pickupLabel}</p>
                </div>
              </div>
              <span className="menu-count">{data.products.length} announced flavors</span>
            </div>
            <div className="product-grid">
              {data.products.map((product) => {
                const blockedBy = product.allergens
                  .filter((allergen) => selectedAllergens.includes(allergen))
                  .map((allergen) => allergenLabels.get(allergen) ?? allergen);
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={quantities[product.id] ?? 0}
                    blockedBy={blockedBy}
                    allergenAvoidanceRequested={selectedAllergens.length > 0}
                    onDecrease={() => changeQuantity(product.id, -1)}
                    onIncrease={() => changeQuantity(product.id, 1)}
                  />
                );
              })}
            </div>
          </section>
        </div>

        <CartSummary
          products={data.products}
          quantities={quantities}
          pickupLabel={pickupLabel}
          onReview={() => send({ type: 'DETAILS' })}
        />
      </main>

      <footer>
        <strong>Dough Monster</strong>
        <span>Small batches. Big feelings.</span>
        <a href="#page-title">Back to top ↑</a>
      </footer>
    </div>
  );
}

function availabilityLabel(availability: 'available' | 'limited' | 'closed' | 'sold_out') {
  if (availability === 'limited') return 'Filling up';
  if (availability === 'closed') return 'Closed';
  if (availability === 'sold_out') return 'Sold out';
  return 'Available';
}

function PreorderSkeleton() {
  return (
    <main className="skeleton-page" aria-busy="true" aria-label="Loading preorder menu">
      <div className="skeleton skeleton-header" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </main>
  );
}
