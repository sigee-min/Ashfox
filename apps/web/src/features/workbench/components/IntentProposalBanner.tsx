import type {
  ProjectDocument
} from '@ashfox/engine-core';

import {
  intentProgramCompilationState
} from '../intentProposalConfirmation';

interface IntentProposalBannerProps {
  document: ProjectDocument;
  activeOperationOwner: string | null;
  onConfirm: () => void;
}

export function IntentProposalBanner({
  document,
  activeOperationOwner,
  onConfirm
}: IntentProposalBannerProps) {
  const proposal = document.intentProgramProposal;
  const confirmation = intentProgramCompilationState(
    document,
    activeOperationOwner
  );
  if (!proposal || !confirmation.visible) return null;

  return (
    <section
      className="intent-proposal-banner"
      aria-label="Intent Program proposal"
      aria-describedby="intent-proposal-note"
      data-confirm-disabled={confirmation.disabled}
      data-scroll-region="intent-proposal"
      tabIndex={0}
    >
      <div className="intent-proposal-heading">
        <div>
          <span className="intent-proposal-eyebrow">Intent Program</span>
          <strong>Review the next generated asset</strong>
        </div>
        <button
          type="button"
          className="intent-proposal-confirm"
          disabled={confirmation.disabled}
          onClick={onConfirm}
        >
          Compile reviewed program
        </button>
      </div>
      <dl className="intent-proposal-summary">
        <div><dt>Program hash</dt><dd>{proposal.hash}</dd></div>
        <div><dt>Source</dt><dd><pre>{proposal.source}</pre></dd></div>
      </dl>
      <p className="intent-proposal-note" id="intent-proposal-note">
        {confirmation.reason ??
          'The compiler atomically replaces the entire generated asset from this source. It never applies a one-sided patch.'}
      </p>
    </section>
  );
}
