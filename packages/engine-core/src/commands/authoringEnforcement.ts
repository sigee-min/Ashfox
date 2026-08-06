import { evaluateAuthoringPlan, composeAuthoringSlots } from '../authoring/authoringPlan';
import { readAuthoringProfile } from '../authoring/authoringProfile';
import { authoringRoutingMatches } from '../authoring/authoringRouting';
import type { ProjectDocument } from '../model';
import type { ProjectCommandOperation } from './types';

export interface AuthoringEnforcementIssue {
  message: string;
  path: string;
  expected: string;
}

const isGuardedModelMutation = (
  operation: ProjectCommandOperation
): operation is Extract<ProjectCommandOperation, {
  name:
    | 'model.parts.upsert'
    | 'model.parts.mirror'
    | 'model.parts.transform'
    | 'model.parts.material'
    | 'model.parts.delete';
}> =>
  operation.name === 'model.parts.upsert' ||
  operation.name === 'model.parts.mirror' ||
  operation.name === 'model.parts.transform' ||
  operation.name === 'model.parts.material' ||
  operation.name === 'model.parts.delete';

const isGuardedMotionMutation = (
  operation: ProjectCommandOperation
): operation is Extract<ProjectCommandOperation, {
  name: 'animation.motion.upsert' | 'animation.clip.delete';
}> =>
  operation.name === 'animation.motion.upsert' ||
  operation.name === 'animation.clip.delete';

const isStrictPartResultMutation = (
  operation: ProjectCommandOperation
): operation is Extract<ProjectCommandOperation, {
  name: 'model.parts.upsert' | 'model.parts.mirror';
}> =>
  operation.name === 'model.parts.upsert' ||
  operation.name === 'model.parts.mirror';

export const validateAgentAuthoringMutation = (
  document: ProjectDocument,
  operation: ProjectCommandOperation
): AuthoringEnforcementIssue | null => {
  if (!isGuardedModelMutation(operation) && !isGuardedMotionMutation(operation)) {
    return null;
  }
  if (!document.intent) {
    return {
      message: 'Agent authoring requires project intent and grounded claims.',
      path: 'payload',
      expected: 'project.intent.set before authoring'
    };
  }
  const read = readAuthoringProfile(document);
  if (!read.ok || !read.profile) {
    return {
      message: 'Agent authoring requires one valid authority profile.',
      path: 'payload',
      expected: 'project.authoring.configure before model or motion authoring'
    };
  }
  const profile = read.profile;
  if (!authoringRoutingMatches(document, profile.routing)) {
    return {
      message:
        'The authoring authority profile is stale for current intent, references, or delivery target.',
      path: 'payload',
      expected: 'replace the profile through project.authoring.configure'
    };
  }
  const plannedPartIds = new Set([
    ...profile.slots.flatMap((assignment) => assignment.partIds),
    ...profile.bindings.flatMap((binding) =>
      binding.type === 'attachment' ? binding.partIds : []
    )
  ]);

  if (operation.name === 'animation.motion.upsert') {
    const binding = profile.bindings.find((candidate) =>
      candidate.type === 'motion' &&
      candidate.clipId === operation.payload.clipId
    );
    if (!binding || binding.type !== 'motion') {
      return {
        message:
          `Motion clip "${operation.payload.clipId}" is outside the authority bindings.`,
        path: 'payload.clipId',
        expected: 'a clip ID bound through project.authoring.configure'
      };
    }
    if (
      operation.payload.role !== undefined &&
      operation.payload.role !== binding.role
    ) {
      return {
        message:
          `Motion clip "${operation.payload.clipId}" must use bound role ` +
          `"${binding.role}".`,
        path: 'payload.role',
        expected: binding.role
      };
    }
    const authoredPartIds = [
      ...(operation.payload.poses ?? []).flatMap((pose) =>
        Object.keys(pose.rotations)
      ),
      ...(operation.payload.spins ?? []).map((spin) => spin.partId)
    ];
    const unplannedPartId = authoredPartIds.find(
      (partId) => !plannedPartIds.has(partId)
    );
    return unplannedPartId
      ? {
          message:
            `Motion targets part "${unplannedPartId}" outside the authority plan.`,
          path: 'payload',
          expected: 'only part IDs owned by authority slots or bindings'
        }
      : null;
  }
  if (operation.name === 'animation.clip.delete') return null;

  if (
    operation.name === 'model.parts.mirror' ||
    operation.name === 'model.parts.transform'
  ) {
    return plannedPartIds.has(operation.payload.rootPartId)
      ? null
      : {
          message:
            `Part root "${operation.payload.rootPartId}" is outside the authority plan.`,
          path: 'payload.rootPartId',
          expected: 'a part ID owned by one authority slot or binding'
        };
  }
  if (operation.name === 'model.parts.material') {
    const unplannedPartId = operation.payload.partIds.find(
      (partId) => !plannedPartIds.has(partId)
    );
    return unplannedPartId
      ? {
          message:
            `Material target "${unplannedPartId}" is outside the authority plan.`,
          path: 'payload.partIds',
          expected: 'only part IDs owned by authority slots or bindings'
        }
      : null;
  }
  if (operation.name === 'model.parts.delete') return null;

  const definitionsByPartId = new Map(
    composeAuthoringSlots(profile).flatMap((definition) => {
      const partIds = definition.authorityType === 'archetype'
        ? profile.slots.find((entry) => entry.slotId === definition.id)
            ?.partIds ?? []
        : profile.bindings.flatMap((entry) =>
            entry.type === 'attachment' &&
            entry.contributionId === definition.id
              ? entry.partIds
              : []
          );
      return partIds.map((partId) => [partId, definition] as const);
    })
  );
  for (const [index, part] of operation.payload.parts.entries()) {
    const definition = definitionsByPartId.get(part.partId);
    if (!definition) {
      return {
        message:
          `Part "${part.partId}" was not predeclared by an authority slot or binding.`,
        path: `payload.parts[${index}].partId`,
        expected: 'a predeclared authority-owned part ID'
      };
    }
    if (!definition.acceptedPartKinds.includes(part.kind)) {
      return {
        message:
          `Part "${part.partId}" uses kind "${part.kind}" outside ` +
          `"${definition.id}".`,
        path: `payload.parts[${index}].kind`,
        expected: definition.acceptedPartKinds.join(' | ')
      };
    }
  }
  return null;
};

export const validateAgentAuthoringResult = (
  document: ProjectDocument,
  operation: ProjectCommandOperation
): AuthoringEnforcementIssue | null => {
  if (!isStrictPartResultMutation(operation)) return null;
  const evaluation = evaluateAuthoringPlan(document);
  const unassigned = evaluation.unassignedPartIds[0];
  if (unassigned) {
    return {
      message:
        `Resulting part "${unassigned}" is outside the authority plan.`,
      path: operation.name === 'model.parts.mirror'
        ? 'payload.targetRootPartId'
        : 'payload.parts',
      expected:
        'predeclare every generated part in project.authoring.configure'
    };
  }
  const invalid = evaluation.slots.find((slot) =>
    slot.invalidKindPartIds.length > 0 ||
    slot.invalidHierarchyPartIds.length > 0 ||
    slot.invalidSpatialPartIds.length > 0 ||
    slot.invalidFacingPartIds.length > 0
  );
  return invalid
    ? {
        message:
          `Resulting slot "${invalid.slotId}" violates its semantic contract.`,
        path: operation.name === 'model.parts.mirror'
          ? 'payload.targetRootPartId'
          : 'payload.parts',
        expected: invalid.instruction
      }
    : null;
};
