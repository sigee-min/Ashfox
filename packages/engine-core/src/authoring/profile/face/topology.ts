import type { ProjectIntent } from '../../../model';
import {
  addAuthoringProfileIssue,
  type AuthoringProfileIssue
} from '../evidence';
import type {
  AuthoringFaceComponentDeclaration,
  AuthoringSlotAssignment
} from '../../contract';

export interface AuthoringFaceHostValidation {
  readonly hostSlotId: string | null;
  readonly hostSlot: AuthoringSlotAssignment | undefined;
}

const slotDescendsFrom = (
  slotId: string,
  hostSlotId: string,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>
): boolean => {
  const pending = [...(slotsById.get(slotId)?.parentSlotIds ?? [])];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!candidate || visited.has(candidate)) continue;
    if (candidate === hostSlotId) return true;
    visited.add(candidate);
    pending.push(...(slotsById.get(candidate)?.parentSlotIds ?? []));
  }
  return false;
};

const focalFrameAncestorSlotId = (
  slot: AuthoringSlotAssignment,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>
): string | null => {
  const pending = [...slot.parentSlotIds];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const candidateId = pending.pop();
    if (!candidateId || visited.has(candidateId)) continue;
    visited.add(candidateId);
    const candidate = slotsById.get(candidateId);
    if (!candidate) continue;
    if (candidate.structuralRole === 'focal-frame') return candidateId;
    pending.push(...candidate.parentSlotIds);
  }
  return null;
};

export const validateAuthoringFaceHost = (
  hostSlotId: string | null,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>,
  intent: ProjectIntent | undefined,
  issues: AuthoringProfileIssue[]
): AuthoringFaceHostValidation => {
  const hostSlot = hostSlotId ? slotsById.get(hostSlotId) : undefined;
  if (!hostSlotId || hostSlot?.structuralRole !== 'focal-frame') {
    addAuthoringProfileIssue(
      issues,
      'face.hostSlotId',
      'Full face host must reference a declared focal-frame slot.',
      'one focal-frame slot ID from this profile'
    );
  }
  if (hostSlot && hostSlot.partIds.length !== 1) {
    addAuthoringProfileIssue(
      issues,
      'face.hostSlotId',
      'Full face host must own exactly one canonical surface part.',
      'one non-feature partId; nasal, muzzle, oral, and eye-frame parts belong to separate descendant component slots'
    );
  }
  const nestedFocalFrameId = hostSlot
    ? focalFrameAncestorSlotId(hostSlot, slotsById)
    : null;
  if (nestedFocalFrameId) {
    addAuthoringProfileIssue(
      issues,
      'face.hostSlotId',
      `Full face host cannot be nested below focal-frame slot "${nestedFocalFrameId}".`,
      'a single face host whose ancestor slots use structural core, axis, articulated, span, or accent roles'
    );
  }
  if (
    intent?.symmetry.kind === 'bilateral' &&
    hostSlot &&
    hostSlot.symmetry.kind !== 'centered'
  ) {
    addAuthoringProfileIssue(
      issues,
      'face.hostSlotId',
      'A bilateral full-face host must be centered on the project reflection plane.',
      'a focal-frame slot with symmetry {kind:"centered"}'
    );
  }
  return { hostSlotId, hostSlot };
};

export const validateFaceComponentSlots = (
  slotIds: readonly string[],
  path: string,
  hostSlotId: string | null,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>,
  issues: AuthoringProfileIssue[]
): boolean => slotIds.every((slotId) => {
  if (!slotsById.has(slotId)) {
    addAuthoringProfileIssue(
      issues,
      path,
      `Face component references undeclared slot "${slotId}".`,
      'declared slots below the focal-frame host'
    );
    return false;
  }
  if (hostSlotId && !slotDescendsFrom(slotId, hostSlotId, slotsById)) {
    addAuthoringProfileIssue(
      issues,
      path,
      `Face component slot "${slotId}" is not below host "${hostSlotId}".`,
      'a descendant slot of the focal-frame host'
    );
    return false;
  }
  return true;
});

export const validateEyeSurfaceHosts = (
  components: readonly AuthoringFaceComponentDeclaration[],
  hostSlotId: string | null,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>,
  issues: AuthoringProfileIssue[]
): void => {
  const eye = components.find((entry) => entry.component === 'eye');
  if (!eye) return;
  const eyeFrameSlotIds = new Set(components.flatMap((entry) =>
    entry.component === 'eye-frame' ? entry.slotIds : []
  ));
  const permittedHostSlotIds = new Set([
    ...(hostSlotId === null ? [] : [hostSlotId]),
    ...eyeFrameSlotIds
  ]);
  for (const eyeFrameSlotId of eyeFrameSlotIds) {
    const eyeFrameSlot = slotsById.get(eyeFrameSlotId);
    if (
      !eyeFrameSlot ||
      hostSlotId === null ||
      eyeFrameSlot.parentSlotIds.length !== 1 ||
      eyeFrameSlot.parentSlotIds[0] !== hostSlotId
    ) {
      addAuthoringProfileIssue(
        issues,
        `face.components.eye-frame.${eyeFrameSlotId}`,
        `Eye-frame slot "${eyeFrameSlotId}" must be a direct member of the face host.`,
        'exactly one parentSlotId equal to face.hostSlotId; never a nasal, oral, jaw, or mouth-interior descendant'
      );
    }
    if (eyeFrameSlot && eyeFrameSlot.partIds.length !== 1) {
      addAuthoringProfileIssue(
        issues,
        `face.components.eye-frame.${eyeFrameSlotId}`,
        `Eye-frame slot "${eyeFrameSlotId}" must own exactly one canonical surface part.`,
        'one non-feature partId directly parented to the single face host part'
      );
    }
  }
  const eyeSlotIds = eye.configuration.kind === 'single'
    ? [eye.configuration.slotId]
    : [eye.configuration.leftSlotId, eye.configuration.rightSlotId];
  for (const eyeSlotId of eyeSlotIds) {
    const eyeSlot = slotsById.get(eyeSlotId);
    if (!eyeSlot) continue;
    if (eyeSlot.partIds.length !== 1) {
      addAuthoringProfileIssue(
        issues,
        `face.components.eye.configuration.${eyeSlotId}`,
        `Eye configuration slot "${eyeSlotId}" must own exactly one eye part.`,
        'one canonical eye partId'
      );
    }
    const directParentId = eyeSlot.parentSlotIds.length === 1
      ? eyeSlot.parentSlotIds[0]
      : undefined;
    if (!directParentId || !permittedHostSlotIds.has(directParentId)) {
      addAuthoringProfileIssue(
        issues,
        `face.components.eye.configuration.${eyeSlotId}`,
        `Eye configuration slot "${eyeSlotId}" must be a direct member of the face host or a declared eye-frame component slot.`,
        'exactly one direct parentSlotId equal to face.hostSlotId or an eye-frame slotId; never a nasal, oral, jaw, or mouth-interior descendant'
      );
    }
  }
};
