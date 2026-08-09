import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import type { ProjectIntent } from '../../model';
import { PART_CONTRACT_LIMITS } from '../../modeling/part';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './evidence';
import { AUTHORING_PART_ID_PATTERN } from './primitives';
import { authoringTrackPolicy } from './tracks';
import {
  type AuthoringFeatureCoverage,
  type AuthoringSlotAssignment,
  type AuthoringTrack
} from '../contract';

const COVERAGE_KEYS = new Set(['featureRef', 'slotIds', 'materialIds']);
const FEATURE_REF_PATTERN = /^intent\.features\.(0|[1-9][0-9]*)$/;

const validateTrackCoverage = (
  track: AuthoringTrack | null,
  slots: readonly AuthoringSlotAssignment[],
  coverage: readonly AuthoringFeatureCoverage[],
  issues: AuthoringProfileIssue[]
): void => {
  if (track === null) return;
  const policy = authoringTrackPolicy(track);
  for (const stage of policy.requiredQualityStages) {
    if (!slots.some((slot) => slot.qualityStage === stage)) {
      addIssue(
        issues,
        'track',
        `${policy.label} track requires a declared ${stage} stage module.`,
        `at least one slot in every required stage: ${policy.requiredQualityStages.join(', ')}`
      );
    }
  }
  if (!policy.requireExclusiveCoverageTarget) return;
  const targetCounts = new Map<string, number>();
  for (const entry of coverage) {
    for (const target of [
      ...entry.slotIds.map((slotId) => `slot:${slotId}`),
      ...entry.materialIds.map((materialId) => `material:${materialId}`)
    ]) {
      targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
    }
  }
  for (const entry of coverage) {
    const targets = [
      ...entry.slotIds.map((slotId) => `slot:${slotId}`),
      ...entry.materialIds.map((materialId) => `material:${materialId}`)
    ];
    if (!targets.some((target) => targetCounts.get(target) === 1)) {
      addIssue(
        issues,
        `coverage.${entry.featureRef}`,
        `${policy.label} feature "${entry.featureRef}" has no exclusive realization target.`,
        'at least one slot or explicit material not claimed by another feature'
      );
    }
  }
};

export const readAuthoringCoverage = (
  value: unknown,
  intent: ProjectIntent | undefined,
  slots: readonly AuthoringSlotAssignment[],
  track: AuthoringTrack | null,
  issues: AuthoringProfileIssue[]
): readonly AuthoringFeatureCoverage[] | null => {
  if (
    !isDenseContractArray(value) ||
    value.length > AUTHORING_PROFILE_LIMITS.maxSlots
  ) {
    addIssue(
      issues,
      'coverage',
      'Intent feature coverage must be a bounded dense array.',
      'one coverage entry for every intent.features index'
    );
    return null;
  }
  if (!intent) {
    addIssue(
      issues,
      'coverage',
      'Intent feature coverage requires a current normalized intent.',
      'one authoritative Intent Program source compiled into derived authoring authority'
    );
    return null;
  }
  const slotIdSet = new Set(slots.map((slot) => slot.slotId));
  const coverage: AuthoringFeatureCoverage[] = [];
  value.forEach((entry, index) => {
    const path = `coverage[${index}]`;
    if (
      !isClosedContractRecord(entry) ||
      !hasExactContractKeys(entry, COVERAGE_KEYS)
    ) {
      addIssue(
        issues,
        path,
        'Coverage entry must use the closed contract shape.',
        '{featureRef,slotIds,materialIds}'
      );
      return;
    }
    const match = typeof entry.featureRef === 'string'
      ? FEATURE_REF_PATTERN.exec(entry.featureRef)
      : null;
    const featureIndex = match ? Number(match[1]) : -1;
    const featureRefValid =
      featureIndex >= 0 && featureIndex < intent.features.length;
    if (!featureRefValid) {
      addIssue(
        issues,
        `${path}.featureRef`,
        `Coverage feature reference "${String(entry.featureRef)}" is not current.`,
        `intent.features.0-${Math.max(0, intent.features.length - 1)}`
      );
    }
    const slotIds = isUniqueContractTextArray(entry.slotIds)
      ? entry.slotIds
      : null;
    const slotIdsValid = slotIds !== null &&
      slotIds.length <= AUTHORING_PROFILE_LIMITS.maxSlots &&
      slotIds.every((slotId) => slotIdSet.has(slotId));
    if (!slotIdsValid) {
      addIssue(
        issues,
        `${path}.slotIds`,
        'Coverage slot IDs must be unique declarations on this profile.',
        'zero or more declared structural slot IDs'
      );
    }
    const materialIds = isUniqueContractTextArray(entry.materialIds)
      ? entry.materialIds
      : null;
    const materialIdsValid = materialIds !== null &&
      materialIds.length <= AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner &&
      materialIds.every((materialId) =>
        materialId.length <= PART_CONTRACT_LIMITS.maxIdLength &&
        AUTHORING_PART_ID_PATTERN.test(materialId)
      );
    if (!materialIdsValid) {
      addIssue(
        issues,
        `${path}.materialIds`,
        'Coverage material IDs must be unique canonical IDs.',
        'zero or more explicit modeling material IDs'
      );
    }
    if (
      slotIds !== null &&
      materialIds !== null &&
      slotIds.length === 0 &&
      materialIds.length === 0
    ) {
      addIssue(
        issues,
        path,
        'Coverage entry must declare at least one realization target.',
        'one or more slotIds or materialIds'
      );
    }
    if (
      featureRefValid &&
      slotIdsValid &&
      materialIdsValid &&
      slotIds &&
      materialIds &&
      (slotIds.length > 0 || materialIds.length > 0)
    ) {
      coverage.push({
        featureRef: `intent.features.${featureIndex}`,
        slotIds: [...slotIds].sort((left, right) =>
          left.localeCompare(right)
        ),
        materialIds: [...materialIds].sort((left, right) =>
          left.localeCompare(right)
        )
      });
    }
  });
  const featureRefs = coverage.map((entry) => entry.featureRef);
  const expectedRefs = intent.features.map((_, index) =>
    `intent.features.${index}`
  );
  for (const featureRef of expectedRefs) {
    if (featureRefs.filter((candidate) => candidate === featureRef).length !== 1) {
      addIssue(
        issues,
        'coverage',
        `Intent feature "${featureRef}" must have exactly one coverage entry.`,
        'one closed coverage entry per current intent feature'
      );
    }
  }
  if (featureRefs.some((featureRef) => !expectedRefs.includes(featureRef))) {
    addIssue(
      issues,
      'coverage',
      'Coverage contains a stale intent feature reference.',
      expectedRefs.join(' | ')
    );
  }
  validateTrackCoverage(track, slots, coverage, issues);
  return [...coverage].sort((left, right) => {
    const leftIndex = Number(FEATURE_REF_PATTERN.exec(left.featureRef)?.[1]);
    const rightIndex = Number(FEATURE_REF_PATTERN.exec(right.featureRef)?.[1]);
    return leftIndex - rightIndex;
  });
};
