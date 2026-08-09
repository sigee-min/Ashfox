import type { ProjectIntent } from '../model';
import {
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './authoringEvidence';
import type {
  AuthoringFaceContract,
  AuthoringFaceMode,
  AuthoringRestPose,
  AuthoringSlotAssignment
} from './authoringTypes';

const declaredSupportSlots = (
  slots: readonly AuthoringSlotAssignment[]
): readonly AuthoringSlotAssignment[] => slots.filter(
  (slot) => slot.support.kind !== 'none'
);

const validateCanonicalSupport = (
  intent: ProjectIntent,
  restPose: AuthoringRestPose,
  slots: readonly AuthoringSlotAssignment[],
  issues: AuthoringProfileIssue[]
): void => {
  const contract = intent.semanticContract.canonicalSupport;
  const supportSlots = declaredSupportSlots(slots);
  const expectedMode = contract.kind === 'standing-feet'
    ? 'standing'
    : contract.kind === 'rolling-wheels'
      ? 'rolling'
    : contract.kind === 'supported-base'
      ? 'supported'
      : contract.kind === 'airborne'
        ? 'airborne'
        : 'free';
  if (restPose.mode !== expectedMode) {
    addIssue(
      issues,
      'restPose.mode',
      `Rest pose does not realize canonical support "${contract.kind}".`,
      expectedMode
    );
  }
  if (contract.kind === 'standing-feet') {
    if (supportSlots.length === 0 || supportSlots.some((slot) =>
      slot.support.kind !== 'foot' || slot.support.contact !== 'grounded'
    )) {
      addIssue(
        issues,
        'slots',
        'Standing-feet authority permits only grounded foot supports and requires at least one.',
        'one or more grounded foot slots; no base or free support'
      );
    }
    return;
  }
  if (contract.kind === 'rolling-wheels') {
    if (supportSlots.length === 0 || supportSlots.some((slot) =>
      slot.support.kind !== 'wheel' || slot.support.contact !== 'grounded'
    )) {
      addIssue(
        issues,
        'slots',
        'Rolling-wheel authority permits only grounded wheel supports and requires at least one.',
        'one or more grounded wheel slots; no foot or base support'
      );
    }
    return;
  }
  if (contract.kind === 'supported-base') {
    if (supportSlots.length === 0 || supportSlots.some((slot) =>
      slot.support.kind !== 'base' || slot.support.contact !== 'grounded'
    )) {
      addIssue(
        issues,
        'slots',
        'Supported-base authority permits only grounded base supports and requires at least one.',
        'one or more grounded base slots; no foot or free support'
      );
    }
    return;
  }
  if (supportSlots.some((slot) => slot.support.kind !== 'none' &&
    slot.support.contact !== 'free')) {
    addIssue(
      issues,
      'slots',
      `${contract.kind} authority cannot contain grounded support.`,
      'no support declaration, or typed supports with contact:"free"'
    );
  }
};

const validateFace = (
  intent: ProjectIntent,
  faceMode: AuthoringFaceMode,
  face: AuthoringFaceContract | null,
  issues: AuthoringProfileIssue[]
): void => {
  const contract = intent.semanticContract.face;
  if (contract.kind === 'none') {
    if (faceMode !== 'none' || face !== null) {
      addIssue(
        issues,
        'faceMode',
        'Authoring face contradicts the upstream no-face authority.',
        'faceMode:"none" and face:null'
      );
    }
    return;
  }
  const eye = face?.components.find((component) =>
    component.component === 'eye'
  );
  if (faceMode !== 'full' || !face || eye?.component !== 'eye') {
    addIssue(
      issues,
      'faceMode',
      'Full semantic face authority requires the complete face contract with typed eyes.',
      `faceMode:"full" with ${contract.eyeConfiguration} eye configuration`
    );
    return;
  }
  if (eye.configuration.kind !== contract.eyeConfiguration) {
    addIssue(
      issues,
      'face.components.eye.configuration',
      'Eye configuration contradicts the upstream semantic face authority.',
      contract.eyeConfiguration
    );
  }
  for (const component of ['nasal', 'oral'] as const) {
    const declarations = face.components.filter((entry) =>
      entry.component === component
    );
    const exceptions = face.exceptions.filter((entry) =>
      entry.component === component
    );
    const presence = contract[component];
    const exact = presence === 'present'
      ? declarations.length === 1 && exceptions.length === 0
      : declarations.length === 0 && exceptions.length === 1;
    if (exact) continue;
    addIssue(
      issues,
      `face.${component}`,
      `Face does not realize sealed ${component} state "${presence}".`,
      presence === 'present'
        ? `exactly one ${component} component and no exception`
        : `no ${component} component and exactly one audited exception`
    );
  }
};

const validateSupportedSurfaces = (
  intent: ProjectIntent,
  slots: readonly AuthoringSlotAssignment[],
  issues: AuthoringProfileIssue[]
): void => {
  const obligations = new Map(
    intent.semanticContract.supportedSurfaces.map((obligation) => [
      obligation.id,
      obligation
    ])
  );
  const realized = new Map<string, AuthoringSlotAssignment[]>();
  for (const slot of slots) {
    if (slot.span.kind !== 'supported-surface') continue;
    const group = realized.get(slot.span.obligationId) ?? [];
    group.push(slot);
    realized.set(slot.span.obligationId, group);
    if (!obligations.has(slot.span.obligationId)) {
      addIssue(
        issues,
        `slots.${slot.slotId}.span.obligationId`,
        `Supported surface realizes undeclared obligation "${slot.span.obligationId}".`,
        'an ID from intent.semanticContract.supportedSurfaces'
      );
    }
  }
  for (const obligation of obligations.values()) {
    const group = realized.get(obligation.id) ?? [];
    if (obligation.configuration === 'single') {
      if (group.length !== 1 || group[0]?.symmetry.kind === 'paired') {
        addIssue(
          issues,
          `intent.semanticContract.supportedSurfaces.${obligation.id}`,
          `Single ${obligation.role} obligation must be realized by exactly one non-paired span slot.`,
          `one supported-surface span with obligationId:"${obligation.id}"`
        );
      }
      if (group.length === 1 && intent.symmetry.kind === 'bilateral' &&
        group[0]?.symmetry.kind !== 'centered') {
        addIssue(
          issues,
          `slots.${group[0]?.slotId ?? obligation.id}.symmetry`,
          `Single ${obligation.role} in a bilateral project must be centered.`,
          '{kind:"centered"}'
        );
      }
    } else {
      const pairIds = new Set(group.flatMap((slot) =>
        slot.symmetry.kind === 'paired' ? [slot.symmetry.pairId] : []
      ));
      if (group.length !== 2 ||
        group.some((slot) => slot.symmetry.kind !== 'paired') ||
        pairIds.size !== 1) {
        addIssue(
          issues,
          `intent.semanticContract.supportedSurfaces.${obligation.id}`,
          `Paired ${obligation.role} obligation must be realized by one exact bilateral span pair.`,
          `two paired supported-surface slots sharing obligationId:"${obligation.id}" and pairId`
        );
      }
    }

    const expected = obligation.extension === 'up'
      ? 'above'
      : obligation.extension === 'forward'
        ? 'front'
        : obligation.extension === 'rearward'
          ? 'rear'
          : obligation.extension === 'left'
            ? 'left'
            : obligation.extension === 'right'
              ? 'right'
              : null;
    const opposite = obligation.extension === 'up'
      ? 'below'
      : obligation.extension === 'forward'
        ? 'rear'
        : obligation.extension === 'rearward'
          ? 'front'
          : obligation.extension === 'left'
            ? 'right'
            : obligation.extension === 'right'
              ? 'left'
              : null;
    const invalidExtension = group.find((slot) => {
      if (obligation.extension === 'lateral') {
        const left = slot.spatialRelations.includes('left');
        const right = slot.spatialRelations.includes('right');
        return left === right;
      }
      return !expected || !slot.spatialRelations.includes(expected) ||
        (opposite !== null && slot.spatialRelations.includes(opposite));
    });
    if (invalidExtension) {
      addIssue(
        issues,
        `slots.${invalidExtension.slotId}.spatialRelations`,
        `${obligation.role} span does not realize its sealed "${obligation.extension}" extension.`,
        obligation.extension === 'lateral'
          ? 'exactly one of left or right'
          : `${expected} without ${opposite}`
      );
    }
  }
};

/**
 * Enforces one-way realization: downstream profile fields may realize the
 * semantic intent, but cannot opt out, reinterpret, or add semantic surfaces.
 */
export const validateAuthoringSemanticRealization = (
  intent: ProjectIntent | undefined,
  restPose: AuthoringRestPose | null,
  faceMode: AuthoringFaceMode | null,
  face: AuthoringFaceContract | null,
  slots: readonly AuthoringSlotAssignment[] | null,
  issues: AuthoringProfileIssue[]
): void => {
  if (!intent || !restPose || !faceMode || !slots) return;
  validateCanonicalSupport(intent, restPose, slots, issues);
  validateFace(intent, faceMode, face, issues);
  validateSupportedSurfaces(intent, slots, issues);
};
