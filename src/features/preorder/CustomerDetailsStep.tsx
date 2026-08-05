import { useForm } from 'react-hook-form';
import { Button } from 'react-aria-components';
import {
  type CustomerDetails,
  customerDetailsSchema
} from './draft';

type CustomerDetailsStepProps = {
  initialDetails: CustomerDetails;
  pickupLabel: string;
  onBack: () => void;
  onContinue: (details: CustomerDetails) => void;
  onDraftChange: (details: CustomerDetails) => void;
};

export function CustomerDetailsStep({
  initialDetails,
  pickupLabel,
  onBack,
  onContinue,
  onDraftChange
}: CustomerDetailsStepProps) {
  const {
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setError
  } = useForm<CustomerDetails>({ defaultValues: initialDetails });

  const continueToReview = (values: CustomerDetails) => {
    const result = customerDetailsSchema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          setError(field as keyof CustomerDetails, { message: issue.message });
        }
      }
      return;
    }
    onContinue(result.data);
  };

  return (
    <main className="flow-page">
      <div className="flow-card">
        <span className="eyebrow">Step 2 of 4</span>
        <h1>Who’s picking up?</h1>
        <p className="flow-intro">
          We’ll use these details only for this preorder and pickup updates.
          Payment details are never stored here.
        </p>
        <div className="draft-status" role="status">
          <strong>Development preview</strong>
          <span>No order, payment, or capacity hold will be created.</span>
        </div>
        <p className="pickup-summary"><span aria-hidden="true">↗</span>{pickupLabel}</p>

        <form
          className="details-form"
          onChange={() => onDraftChange(getValues())}
          onSubmit={(event) => void handleSubmit(continueToReview)(event)}
          noValidate
        >
          <label>
            Pickup name
            <input autoComplete="name" {...register('fullName')} aria-invalid={Boolean(errors.fullName)} />
            {errors.fullName && <span className="field-error">{errors.fullName.message}</span>}
          </label>
          <label>
            Email
            <input autoComplete="email" inputMode="email" {...register('email')} aria-invalid={Boolean(errors.email)} />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </label>
          <label>
            Mobile phone
            <input autoComplete="tel" inputMode="tel" {...register('phone')} aria-invalid={Boolean(errors.phone)} />
            {errors.phone && <span className="field-error">{errors.phone.message}</span>}
          </label>
          <label>
            Pickup notes <span className="optional-label">Optional</span>
            <textarea rows={3} {...register('pickupNotes')} aria-invalid={Boolean(errors.pickupNotes)} />
            {errors.pickupNotes && <span className="field-error">{errors.pickupNotes.message}</span>}
          </label>
          <p className="draft-retention">
            A recoverable draft stays in this browser for up to 24 hours and is
            revalidated before any future submission.
          </p>
          <div className="flow-actions">
            <Button className="secondary-button" onPress={onBack}>← Keep shopping</Button>
            <button className="primary-button" type="submit">Review preorder →</button>
          </div>
        </form>
      </div>
    </main>
  );
}
