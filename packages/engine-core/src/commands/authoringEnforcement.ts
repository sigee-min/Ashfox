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

const enforcementIssue = (
  message: string,
  path: string,
  expected: string
): AuthoringEnforcementIssue => ({ message, path, expected });

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
    return enforcementIssue(
      'Agent authoring requires project intent and grounded claims.',
      'payload',
      'project.intent.set before authoring'
    );
  }
  const read = readAuthoringProfile(document);
  if (!read.ok || !read.profile) {
    return enforcementIssue(
      'Agent authoring requires one valid authority profile.',
      'payload',
      'project.authoring.configure before model or motion authoring'
    );
  }
  const profile = read.profile;
  if (!authoringRoutingMatches(document, profile.routing)) {
    return enforcementIssue(
      'The authoring authority profile is stale for current intent, references, or delivery target.',
      'payload',
      'replace the profile through project.authoring.configure'
    );
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
      return enforcementIssue(
        `Motion clip "${operation.payload.clipId}" is outside the authority bindings.`,
        'payload.clipId',
        'a clip ID bound through project.authoring.configure'
      );
    }
    if (
      operation.payload.role !== undefined &&
      operation.payload.role !== binding.role
    ) {
      return enforcementIssue(
        `Motion clip "${operation.payload.clipId}" must use bound role ` +
          `"${binding.role}".`,
        'payload.role',
        binding.role
      );
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
      ? enforcementIssue(
          `Motion targets part "${unplannedPartId}" outside the authority plan.`,
          'payload',
          'only part IDs owned by authority slots or bindings'
        )
      : null;
  }
  if (operation.name === 'animation.clip.delete') return null;

  if (
    operation.name === 'model.parts.mirror' ||
    operation.name === 'model.parts.transform'
  ) {
    return plannedPartIds.has(operation.payload.rootPartId)
      ? null
      : enforcementIssue(
          `Part root "${operation.payload.rootPartId}" is outside the authority plan.`,
          'payload.rootPartId',
          'a part ID owned by one authority slot or binding'
        );
  }
  if (operation.name === 'model.parts.material') {
    const unplannedPartId = operation.payload.partIds.find(
      (partId) => !plannedPartIds.has(partId)
    );
    return unplannedPartId
      ? enforcementIssue(
          `Material target "${unplannedPartId}" is outside the authority plan.`,
          'payload.partIds',
          'only part IDs owned by authority slots or bindings'
        )
      : null;
  }
  if (operation.name === 'model.parts.delete') return null;

  const partIdsByDefinitionId = new Map<string, readonly string[]>([
    ...profile.slots.map((slot) => [slot.slotId, slot.partIds] as const),
    ...profile.bindings.flatMap((binding) =>
      binding.type === 'attachment'
        ? [[binding.contributionId, binding.partIds] as const]
        : []
    )
  ]);
  const definitionsByPartId = new Map(
    composeAuthoringSlots(profile).flatMap((definition) => {
      const partIds = partIdsByDefinitionId.get(definition.id) ?? [];
      return partIds.map((partId) => [partId, definition] as const);
    })
  );
  for (const [index, part] of operation.payload.parts.entries()) {
    const definition = definitionsByPartId.get(part.partId);
    if (!definition) {
      return enforcementIssue(
        `Part "${part.partId}" was not predeclared by an authority slot or binding.`,
        `payload.parts[${index}].partId`,
        'a predeclared authority-owned part ID'
      );
    }
    if (!definition.acceptedPartKinds.includes(part.kind)) {
      return enforcementIssue(
        `Part "${part.partId}" uses kind "${part.kind}" outside ` +
          `"${definition.id}".`,
        `payload.parts[${index}].kind`,
        definition.acceptedPartKinds.join(' | ')
      );
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
  const resultPath = operation.name === 'model.parts.mirror'
    ? 'payload.targetRootPartId'
    : 'payload.parts';
  const unassigned = evaluation.unassignedPartIds[0];
  if (unassigned) {
    return enforcementIssue(
      `Resulting part "${unassigned}" is outside the authority plan.`,
      resultPath,
      'predeclare every generated part in project.authoring.configure'
    );
  }
  const invalid = evaluation.slots.find((slot) =>
    slot.invalidKindPartIds.length > 0 ||
    slot.invalidHierarchyPartIds.length > 0 ||
    slot.invalidSpatialPartIds.length > 0 ||
    slot.invalidFacingPartIds.length > 0
  );
  if (invalid) {
    return enforcementIssue(
      `Resulting slot "${invalid.slotId}" violates its semantic contract.`,
      resultPath,
      invalid.instruction
    );
  }
  const qualityIssue = evaluation.structuralQuality?.issues[0];
  return qualityIssue
    ? enforcementIssue(
        qualityIssue.message,
        resultPath,
        qualityIssue.expected
      )
    : null;
};
