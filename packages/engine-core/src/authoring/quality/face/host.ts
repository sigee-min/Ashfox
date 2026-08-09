import type { PartSpec } from '../../../modeling/part';
import type { AuthoringSlotStatus } from '../../plan/contract';
import type { AuthoringPlanIssue } from '../../plan/contract';
import type {
  AuthoringFaceContract,
  AuthoringProfile
} from '../../contract';
import { authoringPlanIssue } from '../issues';

const canonicalSurfacePart = (
  slot: AuthoringSlotStatus | undefined,
  partsById: ReadonlyMap<string, PartSpec>
): PartSpec | null => {
  if (
    !slot ||
    slot.partIds.length !== 1 ||
    slot.presentPartIds.length !== 1 ||
    slot.partIds[0] !== slot.presentPartIds[0]
  ) {
    return null;
  }
  const part = partsById.get(slot.partIds[0] as string);
  return part && part.kind !== 'feature' ? part : null;
};

const hasFocalFrameAncestor = (
  slot: AuthoringSlotStatus | undefined,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>
): boolean => {
  if (!slot) return false;
  const pending = [...slot.parentSlotIds];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const candidateId = pending.pop();
    if (!candidateId || visited.has(candidateId)) continue;
    visited.add(candidateId);
    const candidate = slotsById.get(candidateId);
    if (!candidate) continue;
    if (candidate.structuralRole === 'focal-frame') return true;
    pending.push(...candidate.parentSlotIds);
  }
  return false;
};

const permittedEyeSurfaceHosts = (
  face: AuthoringFaceContract,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>,
  partsById: ReadonlyMap<string, PartSpec>
): ReadonlySet<string> => {
  const host = slotsById.get(face.hostSlotId);
  const actualHostPart = canonicalSurfacePart(host, partsById);
  if (!actualHostPart) return new Set();
  const directEyeFrames = face.components.flatMap((component) =>
    component.component === 'eye-frame' ? component.slotIds : []
  ).filter((slotId) => {
    const slot = slotsById.get(slotId);
    const actualFramePart = canonicalSurfacePart(slot, partsById);
    return slot?.parentSlotIds.length === 1 &&
      slot.parentSlotIds[0] === face.hostSlotId &&
      actualFramePart?.parentPartId === actualHostPart.partId;
  });
  return new Set([face.hostSlotId, ...directEyeFrames]);
};

export interface CanonicalFaceHostEvaluation {
  readonly ready: boolean;
  readonly partId: string | null;
  readonly partIds: ReadonlySet<string>;
  readonly permittedEyeSurfaceHostSlotIds: ReadonlySet<string>;
  readonly issues: readonly AuthoringPlanIssue[];
  readonly violations: readonly AuthoringPlanIssue[];
}

export const evaluateCanonicalFaceHost = (
  face: AuthoringFaceContract,
  profile: AuthoringProfile,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>,
  partsById: ReadonlyMap<string, PartSpec>
): CanonicalFaceHostEvaluation => {
  const slot = slotsById.get(face.hostSlotId);
  const surfacePart = canonicalSurfacePart(slot, partsById);
  const ready = slot?.state === 'complete' &&
    surfacePart !== null &&
    !hasFocalFrameAncestor(slot, slotsById);
  const issue = ready
    ? null
    : authoringPlanIssue(
        'authoring.plan.face_host_incomplete',
        'authoringProfile.face.hostSlotId',
        `Full-face host "${face.hostSlotId}" is not one complete canonical surface part.`,
        'one materialized non-feature host part outside every other focal-frame subtree; nasal, muzzle, oral, and eye-frame parts use separate descendant slots',
        {
          authority: profile.archetype,
          partIds: slot?.partIds ?? []
        }
      );
  return {
    ready,
    partId: surfacePart?.partId ?? null,
    partIds: new Set(surfacePart ? [surfacePart.partId] : []),
    permittedEyeSurfaceHostSlotIds: permittedEyeSurfaceHosts(
      face,
      slotsById,
      partsById
    ),
    issues: issue ? [issue] : [],
    violations: issue && (slot?.presentPartIds.length ?? 0) > 0 ? [issue] : []
  };
};
