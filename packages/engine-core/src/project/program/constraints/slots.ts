import { INTENT_PROGRAM_INVARIANTS } from './policy';

type IntentProgramAttachmentClaimKind = 'body' | 'surface';

export interface IntentProgramAttachmentClaims {
  body: string[];
  surface: string[];
}

export interface IntentProgramAttachmentClaim {
  readonly kind: IntentProgramAttachmentClaimKind;
  readonly parent: string;
  readonly anchor: string;
  readonly lane: string;
  readonly owner: string;
}

export const INTENT_PROGRAM_ATTACHMENT_SLOT_POLICY =
  INTENT_PROGRAM_INVARIANTS.attachmentSlots;

const conflictingClaim = (
  claims: IntentProgramAttachmentClaims,
  kind: IntentProgramAttachmentClaimKind
): string | undefined => {
  for (const pair of
    INTENT_PROGRAM_ATTACHMENT_SLOT_POLICY.mutuallyExclusiveClaimKinds) {
    if (!pair.includes(kind)) continue;
    const other = pair[0] === kind ? pair[1] : pair[0];
    const existing = claims[other][0];
    if (existing) return existing;
  }
  return undefined;
};

/** Shared indexed allocator for the closed semantic attachment capacity. */
export const claimIntentProgramAttachmentSlot = (
  slots: Map<string, IntentProgramAttachmentClaims>,
  claim: IntentProgramAttachmentClaim
): string | undefined => {
  const key = INTENT_PROGRAM_ATTACHMENT_SLOT_POLICY.keyFields
    .map((field) => claim[field])
    .join('\u0000');
  const current = slots.get(key) ?? { body: [], surface: [] };
  const conflict = conflictingClaim(current, claim.kind);
  if (conflict) return conflict;
  const owners = current[claim.kind];
  const capacity =
    INTENT_PROGRAM_ATTACHMENT_SLOT_POLICY.capacityByClaimKind[claim.kind];
  if (owners.length >= capacity) return owners[capacity - 1] ?? owners[0];
  owners.push(claim.owner);
  slots.set(key, current);
  return undefined;
};
