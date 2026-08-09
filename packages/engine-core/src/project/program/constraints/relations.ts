import {
  intentProgramModuleRelationIssues,
  intentProgramSurfaceRelationIssues,
  intentProgramSurfaceShapeIssues,
  isIntentProgramLaneCompatible
} from './matrix';
import { resolveIntentProgramBodyGraph, type IntentProgramBodyGraph } from './graph';
import {
  addConstraintIssue,
  type ConstraintState
} from './analysis';
import { claimIntentProgramAttachmentSlot } from './slots';
import { resolveIntentProgramVocabulary } from '../schema';
import { INTENT_PROGRAM_INVARIANTS } from './policy';

export const INTENT_PROGRAM_PRESENTATION_SLOT =
  INTENT_PROGRAM_INVARIANTS.attachmentSlots.presentation.slot;
const presentationClaimKinds =
  INTENT_PROGRAM_INVARIANTS.attachmentSlots.presentation.claimKinds;
const bodyParentReference = INTENT_PROGRAM_INVARIANTS.references.bodyParent;
const surfaceParentReference =
  INTENT_PROGRAM_INVARIANTS.references.surfaceParent;
const bodyParentKinds = new Set(
  resolveIntentProgramVocabulary(bodyParentReference.allowedKinds)
);
const surfaceParentKinds = new Set(
  resolveIntentProgramVocabulary(surfaceParentReference.allowedKinds)
);

const notePresentationClaim = (
  state: ConstraintState,
  parent: string,
  anchor: string,
  lane: string,
  claimKind: 'body' | 'surface',
  owner: string
): void => {
  if (!presentationClaimKinds.includes(claimKind) ||
    anchor !== INTENT_PROGRAM_PRESENTATION_SLOT.anchor ||
    lane !== INTENT_PROGRAM_PRESENTATION_SLOT.lane
  ) return;
  const claims = state.presentationClaims.get(parent);
  if (claims) claims.push(owner);
  else state.presentationClaims.set(parent, [owner]);
};

const claimBodyAttachment = (
  state: ConstraintState,
  parent: string,
  anchor: string,
  lane: string,
  owner: string,
  path: string
): void => {
  state.counters.attachmentConflictChecks += 1;
  const existing = claimIntentProgramAttachmentSlot(state.attachmentSlots, {
    kind: 'body', parent, anchor, lane, owner
  });
  if (existing) addConstraintIssue(
    state,
    'intent.attachment_slot_conflict',
    `Attachment ${owner} conflicts with ${existing} at ${parent}/${anchor}/${lane}.`,
    path
  );
  notePresentationClaim(state, parent, anchor, lane, 'body', owner);
};

const claimSurfaceAttachment = (
  state: ConstraintState,
  parent: string,
  anchor: string,
  lane: string,
  owner: string,
  path: string
): void => {
  state.counters.attachmentConflictChecks += 1;
  const existing = claimIntentProgramAttachmentSlot(state.attachmentSlots, {
    kind: 'surface', parent, anchor, lane, owner
  });
  if (existing) addConstraintIssue(
    state,
    'intent.attachment_slot_conflict',
    `Attachment ${owner} conflicts with ${existing} at ${parent}/${anchor}/${lane}.`,
    path
  );
  notePresentationClaim(state, parent, anchor, lane, 'surface', owner);
};

const validateBodyRelations = (state: ConstraintState): void => {
  for (const module of state.ast.model.body) {
    if (module.kind === 'core') continue;
    const parent = bodyParentReference.namespace === 'body'
      ? state.moduleById.get(module.parent)
      : undefined;
    if (!parent) addConstraintIssue(
      state,
      'intent.unknown_body_parent',
      `Body module "${module.id}" names unknown parent "${module.parent}".`,
      `body.${module.id}.parent`
    );
    else if (!bodyParentKinds.has(parent.kind)) {
      addConstraintIssue(
        state,
        'intent.unsupported_body_parent',
        `Body module "${module.id}" cannot attach to ${parent.kind} parent "${parent.id}".`,
        `body.${module.id}.parent`
      );
    }
    for (const relation of intentProgramModuleRelationIssues(module)) {
      addConstraintIssue(
        state,
        'intent.invalid_body_attachment',
        `Body module "${module.id}": ${relation.message}.`,
        `body.${module.id}.${relation.field}`
      );
    }
    if (!isIntentProgramLaneCompatible(module.anchor, module.lane)) {
      addConstraintIssue(
        state,
        'intent.invalid_body_lane',
        `Lane ${module.lane} runs along the normal axis of anchor ${module.anchor}.`,
        `body.${module.id}.lane`
      );
    }
    claimBodyAttachment(
      state, module.parent, module.anchor, module.lane,
      `body "${module.id}"`, `body.${module.id}.lane`
    );
  }
};

const validateSurfaceRelations = (state: ConstraintState): void => {
  for (const surface of state.ast.model.surfaces) {
    const parent = surfaceParentReference.namespace === 'body'
      ? state.moduleById.get(surface.parent)
      : undefined;
    if (!parent) addConstraintIssue(
      state,
      'intent.unknown_surface_parent',
      `Surface "${surface.id}" names unknown parent "${surface.parent}".`,
      `surfaces.${surface.id}.parent`
    );
    else if (!surfaceParentKinds.has(parent.kind)) {
      addConstraintIssue(
        state,
        'intent.unsupported_surface_parent',
        `Surface "${surface.id}" cannot attach to ${parent.kind} parent "${parent.id}".`,
        `surfaces.${surface.id}.parent`
      );
    }
    for (const relation of intentProgramSurfaceRelationIssues(surface)) {
      addConstraintIssue(
        state,
        'intent.invalid_surface_attachment',
        `Surface "${surface.id}": ${relation.message}.`,
        `surfaces.${surface.id}.${relation.field}`
      );
    }
    if (!isIntentProgramLaneCompatible(surface.anchor, surface.lane)) {
      addConstraintIssue(
        state,
        'intent.invalid_surface_lane',
        `Lane ${surface.lane} runs along the normal axis of anchor ${surface.anchor}.`,
        `surfaces.${surface.id}.lane`
      );
    }
    claimSurfaceAttachment(
      state, surface.parent, surface.anchor, surface.lane,
      `surface "${surface.id}"`, `surfaces.${surface.id}.lane`
    );
    const shape = state.shapeBySurface.get(surface.id);
    if (!shape) continue;
    for (const entry of intentProgramSurfaceShapeIssues(surface.growth, shape)) {
      addConstraintIssue(
        state,
        entry.code,
        `Surface "${surface.id}": ${entry.message}`,
        `surfaces.${surface.id}.shape.${entry.field}`
      );
    }
  }
};

export const validateIntentProgramRelations = (
  state: ConstraintState
): IntentProgramBodyGraph => {
  validateBodyRelations(state);
  validateSurfaceRelations(state);
  const graph = resolveIntentProgramBodyGraph(
    state.ast.model.body,
    state.moduleIndex
  );
  if (INTENT_PROGRAM_INVARIANTS.body.parentGraph === 'acyclic') {
    for (const module of graph.cyclic) addConstraintIssue(
      state,
      'intent.body_parent_cycle',
      `Body parent graph contains a cycle through "${module.id}".`,
      `body.${module.id}.parent`
    );
  }
  return graph;
};
