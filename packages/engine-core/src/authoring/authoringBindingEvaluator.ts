import type {
  ArchetypeDefinition,
  AuthoringAttachmentBinding,
  AuthoringCompatibilityIssue,
  AuthoringMotionBinding,
  AuthoringProfile,
  SpecialistDefinition
} from './authoringTypes';
import { authoringCompatibilityIssue as issue } from './authoringIssueFactories';

type ContributionEntry = {
  readonly contribution: SpecialistDefinition['contributions'][number];
  readonly specialist: SpecialistDefinition;
  readonly requirement:
    SpecialistDefinition['attachmentRequirements'][number] | undefined;
};

type IndexedAttachmentBinding = {
  readonly binding: AuthoringAttachmentBinding;
  readonly index: number;
};

type IndexedMotionBinding = {
  readonly binding: AuthoringMotionBinding;
  readonly index: number;
};

const indexedAttachmentBindings = (
  profile: AuthoringProfile
): readonly IndexedAttachmentBinding[] =>
  profile.bindings.flatMap((binding, index) =>
    binding.type === 'attachment' ? [{ binding, index }] : []
  );

const indexedMotionBindings = (
  profile: AuthoringProfile
): readonly IndexedMotionBinding[] =>
  profile.bindings.flatMap((binding, index) =>
    binding.type === 'motion' ? [{ binding, index }] : []
  );

const selectedContributions = (
  specialists: readonly SpecialistDefinition[]
): readonly ContributionEntry[] =>
  specialists.flatMap((specialist) =>
    specialist.contributions.map((contribution) => ({
      contribution,
      specialist,
      requirement: specialist.attachmentRequirements.find(
        (candidate) =>
          candidate.requirementId === contribution.attachmentRequirementId
      )
    }))
  );

interface AttachmentEvaluationContext {
  readonly contributionsById: ReadonlyMap<string, ContributionEntry>;
  readonly portsById: ReadonlyMap<
    string,
    ArchetypeDefinition['attachmentPorts'][number]
  >;
  readonly slotsById: ReadonlyMap<
    string,
    AuthoringProfile['slots'][number]
  >;
  readonly bindingsByContribution: Map<string, number[]>;
  readonly bindingsByPort: Map<string, number[]>;
  readonly issues: AuthoringCompatibilityIssue[];
}

const evaluateAttachmentBinding = (
  entry: IndexedAttachmentBinding,
  context: AttachmentEvaluationContext
): void => {
  const { binding, index } = entry;
  const contributionEntry = context.contributionsById.get(
    binding.contributionId
  );
  const port = context.portsById.get(binding.portId);
  const hostSlot = context.slotsById.get(binding.hostSlotId);
  const contributionBindings = context.bindingsByContribution.get(
    binding.contributionId
  ) ?? [];
  contributionBindings.push(index);
  context.bindingsByContribution.set(
    binding.contributionId,
    contributionBindings
  );
  const portBindings = context.bindingsByPort.get(binding.portId) ?? [];
  portBindings.push(index);
  context.bindingsByPort.set(binding.portId, portBindings);
  if (!contributionEntry) {
    context.issues.push(issue(
      'authoring.compatibility.binding_contribution_unknown',
      `bindings[${index}].contributionId`,
      `Binding references unknown selected contribution "${binding.contributionId}".`,
      'a contribution from one selected specialist'
    ));
  }
  if (!port) {
    context.issues.push(issue(
      'authoring.compatibility.binding_port_unknown',
      `bindings[${index}].portId`,
      `Binding references port "${binding.portId}" not provided by the archetype.`,
      'an attachment port provided by the selected archetype'
    ));
  }
  if (!contributionEntry || !port) return;
  const authority = {
    id: contributionEntry.specialist.id,
    version: contributionEntry.specialist.version
  };
  if (!contributionEntry.requirement) {
    context.issues.push(issue(
      'authoring.compatibility.binding_requirement_unknown',
      `bindings[${index}].contributionId`,
      `Contribution "${binding.contributionId}" has no registered attachment requirement.`,
      contributionEntry.contribution.attachmentRequirementId,
      authority
    ));
  } else if (contributionEntry.requirement.portType !== port.type) {
    context.issues.push(issue(
      'authoring.compatibility.binding_port_type_invalid',
      `bindings[${index}].portId`,
      `Contribution "${binding.contributionId}" requires port type ` +
        `"${contributionEntry.requirement.portType}", not "${port.type}".`,
      contributionEntry.requirement.portType,
      authority
    ));
  }
  if (
    !hostSlot ||
    !port.hostStructuralRoles.includes(hostSlot.structuralRole)
  ) {
    context.issues.push(issue(
      'authoring.compatibility.binding_host_invalid',
      `bindings[${index}].hostSlotId`,
      hostSlot
        ? `Slot "${binding.hostSlotId}" has role ` +
          `"${hostSlot.structuralRole}", which cannot host port "${port.id}".`
        : `Slot "${binding.hostSlotId}" is not declared by this profile.`,
      port.hostStructuralRoles.join(' | '),
      authority
    ));
  }
  if (
    binding.partIds.length < contributionEntry.contribution.minParts ||
    binding.partIds.length > contributionEntry.contribution.maxParts
  ) {
    context.issues.push(issue(
      'authoring.compatibility.binding_cardinality_invalid',
      `bindings[${index}].partIds`,
      `Contribution "${binding.contributionId}" owns ` +
        `${binding.partIds.length} planned part IDs.`,
      `${contributionEntry.contribution.minParts}-` +
        `${contributionEntry.contribution.maxParts} part IDs`,
      authority
    ));
  }
  if (
    port.acceptsFacets.length > 0 &&
    !contributionEntry.specialist.facets.some((facet) =>
      port.acceptsFacets.includes(facet)
    )
  ) {
    context.issues.push(issue(
      'authoring.compatibility.binding_facet_invalid',
      `bindings[${index}]`,
      `Port "${port.id}" does not accept any facet from specialist ` +
        `"${contributionEntry.specialist.id}".`,
      port.acceptsFacets.join(' | '),
      authority
    ));
  }
};

const evaluateAttachmentBindings = (
  profile: AuthoringProfile,
  archetype: ArchetypeDefinition,
  specialists: readonly SpecialistDefinition[]
): readonly AuthoringCompatibilityIssue[] => {
  const issues: AuthoringCompatibilityIssue[] = [];
  const contributions = selectedContributions(specialists);
  const bindingsByContribution = new Map<string, number[]>();
  const bindingsByPort = new Map<string, number[]>();
  const context: AttachmentEvaluationContext = {
    contributionsById: new Map(
      contributions.map((entry) => [entry.contribution.id, entry])
    ),
    portsById: new Map(
      archetype.attachmentPorts.map((port) => [port.id, port])
    ),
    slotsById: new Map(
      profile.slots.map((slot) => [slot.slotId, slot])
    ),
    bindingsByContribution,
    bindingsByPort,
    issues
  };
  indexedAttachmentBindings(profile).forEach((entry) =>
    evaluateAttachmentBinding(entry, context)
  );
  for (const { contribution, specialist } of contributions) {
    const indexes = bindingsByContribution.get(contribution.id) ?? [];
    if (contribution.required && indexes.length === 0) {
      issues.push(issue(
        'authoring.compatibility.required_binding_missing',
        'bindings',
        `Required contribution "${contribution.id}" is not bound to an archetype port.`,
        `one binding for ${contribution.id}`,
        { id: specialist.id, version: specialist.version }
      ));
    }
    if (indexes.length > 1) {
      issues.push(issue(
        'authoring.compatibility.binding_duplicated',
        `bindings[${indexes[1]}]`,
        `Contribution "${contribution.id}" is bound more than once.`,
        'exactly one binding per contribution',
        { id: specialist.id, version: specialist.version }
      ));
    }
  }
  for (const port of archetype.attachmentPorts) {
    const indexes = bindingsByPort.get(port.id) ?? [];
    if (indexes.length > port.capacity) {
      issues.push(issue(
        'authoring.compatibility.port_capacity_exceeded',
        `bindings[${indexes[port.capacity]}].portId`,
        `Port "${port.id}" capacity ${port.capacity} is exceeded by ${indexes.length} bindings.`,
        `at most ${port.capacity} binding(s)`
      ));
    }
  }
  return issues;
};

const evaluatePartOwnership = (
  profile: AuthoringProfile
): readonly AuthoringCompatibilityIssue[] => {
  const issues: AuthoringCompatibilityIssue[] = [];
  const firstOwnerByPart = new Map<string, string>();
  for (const assignment of profile.slots) {
    for (const partId of assignment.partIds) {
      const prior = firstOwnerByPart.get(partId);
      if (prior) {
        issues.push(issue(
          'authoring.compatibility.part_reused',
          'slots',
          `Part "${partId}" is assigned to archetype slots "${prior}" and "${assignment.slotId}".`,
          'each part ID owned by one slot or attachment binding'
        ));
      } else {
        firstOwnerByPart.set(partId, assignment.slotId);
      }
    }
  }
  for (const { binding } of indexedAttachmentBindings(profile)) {
    for (const partId of binding.partIds) {
      const prior = firstOwnerByPart.get(partId);
      if (prior) {
        issues.push(issue(
          'authoring.compatibility.bound_part_reused',
          'bindings',
          `Part "${partId}" is owned by both "${prior}" and ` +
            `"${binding.contributionId}".`,
          'each part ID owned by one slot or attachment binding'
        ));
      } else {
        firstOwnerByPart.set(partId, binding.contributionId);
      }
    }
  }
  return issues;
};

const evaluateMotionBindings = (
  profile: AuthoringProfile,
  specialists: readonly SpecialistDefinition[]
): readonly AuthoringCompatibilityIssue[] => {
  const issues: AuthoringCompatibilityIssue[] = [];
  const selectedById = new Map(
    specialists.map((definition) => [definition.id, definition])
  );
  const indexesBySpecialist = new Map<string, number[]>();
  const firstBindingByClip = new Map<string, number>();
  for (const { binding, index } of indexedMotionBindings(profile)) {
    const definition = selectedById.get(binding.specialist.id);
    if (!definition || definition.version !== binding.specialist.version) {
      issues.push(issue(
        'authoring.compatibility.motion_specialist_unknown',
        `bindings[${index}].specialist`,
        `Motion binding references unselected or non-current specialist "${binding.specialist.id}".`,
        'an explicit v2 reference to a selected specialist'
      ));
      continue;
    }
    const requirement = definition.bindingRequirements.find(
      (candidate) => candidate.type === 'motion'
    );
    if (!requirement) {
      issues.push(issue(
        'authoring.compatibility.motion_binding_forbidden',
        `bindings[${index}]`,
        `Specialist "${definition.id}" does not declare a motion binding requirement.`,
        'a specialist with a motion binding requirement',
        { id: definition.id, version: definition.version }
      ));
      continue;
    }
    if (!requirement.allowedRoles.includes(binding.role)) {
      issues.push(issue(
        'authoring.compatibility.motion_role_invalid',
        `bindings[${index}].role`,
        `Role "${binding.role}" is not allowed by specialist "${definition.id}".`,
        requirement.allowedRoles.join(' | '),
        { id: definition.id, version: definition.version }
      ));
    }
    const indexes = indexesBySpecialist.get(definition.id) ?? [];
    indexes.push(index);
    indexesBySpecialist.set(definition.id, indexes);
    const priorClipIndex = firstBindingByClip.get(binding.clipId);
    if (priorClipIndex !== undefined) {
      issues.push(issue(
        'authoring.compatibility.motion_clip_duplicated',
        `bindings[${index}].clipId`,
        `Clip "${binding.clipId}" is bound more than once.`,
        'one specialist binding per clip'
      ));
    } else {
      firstBindingByClip.set(binding.clipId, index);
    }
  }
  for (const specialist of specialists) {
    for (const requirement of specialist.bindingRequirements) {
      const indexes = indexesBySpecialist.get(specialist.id) ?? [];
      if (
        indexes.length < requirement.minBindings ||
        indexes.length > requirement.maxBindings
      ) {
        issues.push(issue(
          'authoring.compatibility.motion_binding_count_invalid',
          'bindings',
          `Specialist "${specialist.id}" has ${indexes.length} motion bindings.`,
          `${requirement.minBindings}-${requirement.maxBindings} motion binding(s)`,
          { id: specialist.id, version: specialist.version }
        ));
      }
    }
  }
  return issues;
};

export const evaluateAuthoringBindings = (
  profile: AuthoringProfile,
  archetype: ArchetypeDefinition,
  specialists: readonly SpecialistDefinition[]
): readonly AuthoringCompatibilityIssue[] => [
  ...evaluateAttachmentBindings(profile, archetype, specialists),
  ...evaluatePartOwnership(profile),
  ...evaluateMotionBindings(profile, specialists)
];
