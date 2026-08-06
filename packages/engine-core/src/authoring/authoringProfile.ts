import {
  hasExactContractKeys,
  isClosedContractRecord,
  isCurrentInternalContractVersion,
  isDenseContractArray,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import { canonicalJsonString } from '../canonicalJson';
import type { ProjectDocument } from '../model';
import {
  PART_CONTRACT_LIMITS,
  PART_ID_PATTERN_SOURCE
} from '../modeling/partContract';
import { evaluateAuthoringCompatibility } from './compatibilityEvaluator';
import {
  resolveArchetypeReference,
  resolveSpecialistReference
} from './authoringRegistry';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  readArchetypeReference,
  readClaims,
  readSpecialistReference,
  readSpecialists,
  type AuthoringProfileIssue
} from './authoringEvidence';
import { authoringRoutingSnapshot } from './authoringRouting';
import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  AUTHORING_ROUTING_CONTRACT_VERSION,
  type ArchetypeDefinition,
  type AuthoringAttachmentBinding,
  type AuthoringBinding,
  type AuthoringMotionBinding,
  type AuthoringMotionRole,
  type AuthoringProfile,
  type AuthoringRoutingSnapshot,
  type AuthoringSelectionInput,
  type AuthoringSlotAssignment,
  type SpecialistDefinition,
  type SpecialistReference
} from './authoringTypes';

export {
  AUTHORING_PROFILE_LIMITS,
  type AuthoringProfileIssue
} from './authoringEvidence';

export type NormalizeAuthoringProfileResult =
  | { ok: true; profile: AuthoringProfile }
  | { ok: false; issues: readonly AuthoringProfileIssue[] };

export type ReadAuthoringProfileResult =
  | { ok: true; profile: AuthoringProfile | null }
  | { ok: false; issues: readonly AuthoringProfileIssue[] };

type AuthoringContext = Pick<
  ProjectDocument,
  'intent' | 'formatProfile'
>;

const PROFILE_KEYS = new Set([
  'schemaVersion',
  'archetype',
  'specialists',
  'claims',
  'routing',
  'slots',
  'bindings'
]);
const SELECTION_KEYS = new Set([
  'archetype',
  'specialists',
  'claims',
  'slots',
  'bindings'
]);
const ROUTING_KEYS = new Set([
  'contractVersion',
  'animationSupported',
  'canonicalInput',
  'referenceIds'
]);
const SLOT_KEYS = new Set(['slotId', 'partIds']);
const SLOT_WITH_REASON_KEYS = new Set(['slotId', 'partIds', 'reason']);
const ATTACHMENT_BINDING_KEYS = new Set([
  'type',
  'contributionId',
  'portId',
  'hostSlotId',
  'partIds'
]);
const MOTION_BINDING_KEYS = new Set([
  'type',
  'specialist',
  'clipId',
  'role'
]);
const PART_ID_PATTERN = new RegExp(PART_ID_PATTERN_SOURCE);
const MOTION_ROLES = new Set<AuthoringMotionRole>([
  'idle',
  'loop',
  'once'
]);

const validPartIds = (
  value: unknown,
  path: string,
  issues: AuthoringProfileIssue[]
): readonly string[] | null => {
  if (
    !isUniqueContractTextArray(value) ||
    value.length === 0 ||
    value.length > AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner ||
    value.some((id) =>
      id.length > PART_CONTRACT_LIMITS.maxIdLength ||
      !PART_ID_PATTERN.test(id)
    )
  ) {
    addIssue(
      issues,
      path,
      'Part IDs must be a non-empty unique bounded array of canonical IDs.',
      `1-${AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner} valid part IDs`
    );
    return null;
  }
  return [...value].sort((left, right) => left.localeCompare(right));
};

const readRouting = (
  value: unknown,
  issues: AuthoringProfileIssue[]
): AuthoringRoutingSnapshot | null => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, ROUTING_KEYS) ||
    !isCurrentInternalContractVersion(
      'authoringRouting',
      value.contractVersion
    ) ||
    typeof value.animationSupported !== 'boolean' ||
    !isNonEmptyContractText(value.canonicalInput) ||
    !isUniqueContractTextArray(value.referenceIds)
  ) {
    addIssue(
      issues,
      'routing',
      'Routing snapshot must use the complete current v1 contract.',
      '{contractVersion:1,animationSupported,canonicalInput,referenceIds}'
    );
    return null;
  }
  return {
    contractVersion: AUTHORING_ROUTING_CONTRACT_VERSION,
    animationSupported: value.animationSupported,
    canonicalInput: value.canonicalInput,
    referenceIds: [...value.referenceIds].sort((left, right) =>
      left.localeCompare(right)
    )
  };
};

const readSlots = (
  value: unknown,
  archetype: ReturnType<typeof resolveArchetypeReference>,
  issues: AuthoringProfileIssue[]
): readonly AuthoringSlotAssignment[] | null => {
  if (!isDenseContractArray(value) || value.length > AUTHORING_PROFILE_LIMITS.maxSlots) {
    addIssue(
      issues,
      'slots',
      'Slot assignments must be a bounded array.',
      `0-${AUTHORING_PROFILE_LIMITS.maxSlots} archetype slot assignments`
    );
    return null;
  }
  const definitionsById = new Map(
    (archetype?.semanticSlots ?? []).map((slot) => [slot.id, slot])
  );
  const slots: AuthoringSlotAssignment[] = [];
  value.forEach((entry, index) => {
    const path = `slots[${index}]`;
    if (!isClosedContractRecord(entry)) {
      addIssue(issues, path, 'Slot assignment must be an object.', '{slotId,partIds,reason?}');
      return;
    }
    const hasReason = Object.prototype.hasOwnProperty.call(entry, 'reason');
    if (!hasExactContractKeys(entry, hasReason ? SLOT_WITH_REASON_KEYS : SLOT_KEYS)) {
      addIssue(issues, path, 'Slot assignment must use the closed v1 shape.', '{slotId,partIds,reason?}');
      return;
    }
    const definition = typeof entry.slotId === 'string'
      ? definitionsById.get(entry.slotId)
      : undefined;
    if (!definition) {
      addIssue(issues, `${path}.slotId`, `Unknown archetype slot "${String(entry.slotId)}".`, 'a semantic slot on the selected archetype');
      return;
    }
    const partIds = validPartIds(entry.partIds, `${path}.partIds`, issues);
    const reason = entry.reason;
    if (
      definition.required && reason !== undefined ||
      !definition.required && !isNonEmptyContractText(reason)
    ) {
      addIssue(
        issues,
        `${path}.reason`,
        definition.required
          ? 'Required archetype slots cannot carry an optional reason.'
          : 'An assigned optional archetype slot requires an explicit rationale.',
        definition.required ? 'omit reason' : 'non-empty reason'
      );
    }
    if (
      partIds &&
      (partIds.length < definition.minParts ||
        partIds.length > definition.maxParts)
    ) {
      addIssue(
        issues,
        `${path}.partIds`,
        `Slot "${definition.id}" violates its planned cardinality.`,
        `${definition.minParts}-${definition.maxParts} part IDs`
      );
    }
    if (partIds) {
      slots.push({
        slotId: definition.id,
        partIds,
        ...(!definition.required && typeof reason === 'string'
          ? { reason }
          : {})
      });
    }
  });
  const slotIds = slots.map((slot) => slot.slotId);
  if (new Set(slotIds).size !== slotIds.length) {
    addIssue(issues, 'slots', 'Each archetype slot may be assigned once.', 'unique slot IDs');
  }
  for (const definition of archetype?.semanticSlots ?? []) {
    if (definition.required && !slotIds.includes(definition.id)) {
      addIssue(
        issues,
        'slots',
        `Required archetype slot "${definition.id}" is not assigned.`,
        'one assignment for every required archetype slot'
      );
    }
  }
  return [...slots].sort((left, right) => left.slotId.localeCompare(right.slotId));
};

const readBindings = (
  value: unknown,
  specialists: readonly SpecialistReference[],
  issues: AuthoringProfileIssue[]
): readonly AuthoringBinding[] | null => {
  if (!isDenseContractArray(value) || value.length > AUTHORING_PROFILE_LIMITS.maxBindings) {
    addIssue(
      issues,
      'bindings',
      'Bindings must be a bounded array.',
      `0-${AUTHORING_PROFILE_LIMITS.maxBindings} closed bindings`
    );
    return null;
  }
  const selectedSpecialistIds = new Set(
    specialists.map((reference) => reference.id)
  );
  const bindings: AuthoringBinding[] = [];
  value.forEach((entry, index) => {
    const path = `bindings[${index}]`;
    if (!isClosedContractRecord(entry) || typeof entry.type !== 'string') {
      addIssue(issues, path, 'Binding must be a tagged closed object.', 'attachment or motion binding');
      return;
    }
    if (entry.type === 'attachment') {
      if (!hasExactContractKeys(entry, ATTACHMENT_BINDING_KEYS)) {
        addIssue(issues, path, 'Attachment binding must use the closed v1 shape.', '{type,contributionId,portId,hostSlotId,partIds}');
        return;
      }
      if (
        !isNonEmptyContractText(entry.contributionId) ||
        !isNonEmptyContractText(entry.portId) ||
        !isNonEmptyContractText(entry.hostSlotId)
      ) {
        addIssue(issues, path, 'Attachment binding IDs must be non-empty.', 'stable contribution, port, and host slot IDs');
        return;
      }
      const partIds = validPartIds(entry.partIds, `${path}.partIds`, issues);
      if (partIds) {
        bindings.push({
          type: 'attachment',
          contributionId: entry.contributionId,
          portId: entry.portId,
          hostSlotId: entry.hostSlotId,
          partIds
        } satisfies AuthoringAttachmentBinding);
      }
      return;
    }
    if (entry.type === 'motion') {
      if (!hasExactContractKeys(entry, MOTION_BINDING_KEYS)) {
        addIssue(issues, path, 'Motion binding must use the closed v1 shape.', '{type,specialist,clipId,role}');
        return;
      }
      const specialist = readSpecialistReference(
        entry.specialist,
        `${path}.specialist`,
        issues
      );
      if (specialist && !selectedSpecialistIds.has(specialist.id)) {
        addIssue(issues, `${path}.specialist`, `Motion specialist "${specialist.id}" is not selected.`, 'an explicit v1 selected specialist reference');
      }
      if (
        !isNonEmptyContractText(entry.clipId) ||
        entry.clipId.length > PART_CONTRACT_LIMITS.maxIdLength ||
        !PART_ID_PATTERN.test(entry.clipId)
      ) {
        addIssue(issues, `${path}.clipId`, 'Motion clip ID is invalid.', 'a canonical stable ID');
      }
      if (typeof entry.role !== 'string' || !MOTION_ROLES.has(entry.role as AuthoringMotionRole)) {
        addIssue(issues, `${path}.role`, 'Motion role is invalid.', 'idle | loop | once');
      }
      if (
        specialist &&
        selectedSpecialistIds.has(specialist.id) &&
        isNonEmptyContractText(entry.clipId) &&
        typeof entry.role === 'string' &&
        MOTION_ROLES.has(entry.role as AuthoringMotionRole)
      ) {
        bindings.push({
          type: 'motion',
          specialist,
          clipId: entry.clipId,
          role: entry.role as AuthoringMotionRole
        } satisfies AuthoringMotionBinding);
      }
      return;
    }
    addIssue(issues, `${path}.type`, `Unknown binding type "${entry.type}".`, 'attachment | motion');
  });
  return [...bindings].sort((left, right) =>
    canonicalJsonString(left).localeCompare(canonicalJsonString(right))
  );
};

const normalizeProfileRecord = (
  value: Readonly<Record<string, unknown>>,
  context: AuthoringContext | undefined,
  issues: AuthoringProfileIssue[]
): AuthoringProfile | null => {
  const archetypeReference = readArchetypeReference(
    value.archetype,
    'archetype',
    issues
  );
  const specialists = readSpecialists(value.specialists, issues);
  const selectedAuthorities = new Map<
    string,
    ArchetypeDefinition | SpecialistDefinition
  >();
  if (archetypeReference) {
    const definition = resolveArchetypeReference(archetypeReference);
    if (definition) selectedAuthorities.set(definition.id, definition);
  }
  for (const reference of specialists ?? []) {
    const definition = resolveSpecialistReference(reference);
    if (definition) selectedAuthorities.set(definition.id, definition);
  }
  const claims = readClaims(
    value.claims,
    selectedAuthorities,
    context?.intent,
    issues
  );
  const routing = readRouting(value.routing, issues);
  const archetype = archetypeReference
    ? resolveArchetypeReference(archetypeReference)
    : undefined;
  const slots = readSlots(value.slots, archetype, issues);
  const bindings = readBindings(value.bindings, specialists ?? [], issues);
  if (
    !archetypeReference ||
    !specialists ||
    !claims ||
    !routing ||
    !slots ||
    !bindings ||
    issues.length > 0
  ) {
    return null;
  }
  const profile: AuthoringProfile = {
    schemaVersion: AUTHORING_PROFILE_SCHEMA_VERSION,
    archetype: archetypeReference,
    specialists,
    claims,
    routing,
    slots,
    bindings
  };
  const compatibility = evaluateAuthoringCompatibility(profile);
  for (const finding of compatibility.issues) {
    addIssue(
      issues,
      finding.path,
      finding.message,
      finding.expected
    );
  }
  return issues.length === 0 ? profile : null;
};

export const normalizeAuthoringProfile = (
  value: unknown,
  context?: AuthoringContext
): NormalizeAuthoringProfileResult => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, PROFILE_KEYS)
  ) {
    return {
      ok: false,
      issues: [{
        path: 'authoringProfile',
        message: 'Authoring profile must use the closed v1 shape.',
        expected:
          '{schemaVersion,archetype,specialists,claims,routing,slots,bindings}'
      }]
    };
  }
  const issues: AuthoringProfileIssue[] = [];
  if (!isCurrentInternalContractVersion('authoringProfile', value.schemaVersion)) {
    addIssue(
      issues,
      'schemaVersion',
      'Authoring profile version is missing or unsupported.',
      'explicit schemaVersion 1'
    );
  }
  const profile = normalizeProfileRecord(value, context, issues);
  return profile && issues.length === 0
    ? { ok: true, profile }
    : { ok: false, issues };
};

export const createAuthoringProfile = (
  document: AuthoringContext,
  input: AuthoringSelectionInput
): NormalizeAuthoringProfileResult => {
  if (!document.intent) {
    return {
      ok: false,
      issues: [{
        path: 'intent',
        message: 'Authoring selection requires a current project intent.',
        expected: 'project.intent.set before project.authoring.configure'
      }]
    };
  }
  if (
    !isClosedContractRecord(input) ||
    !hasExactContractKeys(input, SELECTION_KEYS)
  ) {
    return {
      ok: false,
      issues: [{
        path: 'authoringProfile',
        message: 'Authoring selection must use the closed v1 shape.',
        expected: '{archetype,specialists,claims,slots,bindings}'
      }]
    };
  }
  const routing = authoringRoutingSnapshot(document);
  if (!routing) {
    return {
      ok: false,
      issues: [{
        path: 'routing',
        message: 'Authoring routing snapshot is unavailable.',
        expected: 'a current normalized project intent'
      }]
    };
  }
  return normalizeAuthoringProfile({
    schemaVersion: AUTHORING_PROFILE_SCHEMA_VERSION,
    archetype: input.archetype,
    specialists: input.specialists,
    claims: input.claims,
    routing,
    slots: input.slots,
    bindings: input.bindings
  }, document);
};

export const readAuthoringProfile = (
  document: AuthoringContext & { readonly authoringProfile?: unknown }
): ReadAuthoringProfileResult => {
  if (document.authoringProfile === undefined) {
    return { ok: true, profile: null };
  }
  const result = normalizeAuthoringProfile(
    document.authoringProfile,
    document
  );
  if (!result.ok) return result;
  if (
    canonicalJsonString(document.authoringProfile) !==
    canonicalJsonString(result.profile)
  ) {
    return {
      ok: false,
      issues: [{
        path: 'authoringProfile',
        message: 'Stored authoring profile is not in canonical v1 form.',
        expected: 'replace it through project.authoring.configure'
      }]
    };
  }
  return result;
};
