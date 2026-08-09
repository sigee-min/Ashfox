import type {
  AuthoringFootDigit,
  AuthoringSlotAssignment,
  AuthoringSupport
} from '../../contract';
import {
  SUPPORT_QUALITY_EPSILON as EPSILON,
  addSupportQualityIssue as addIssue,
  belowGroundCellCount,
  cellsForParts,
  environmentWithout,
  exposedCellCount,
  groundContactCellCount,
  isStrictDescendant,
  minimumMargin,
  supportDot as dot,
  supportQualityIssue as issue,
  supportRegionMetrics as regionMetrics
} from './geometry';
import { evaluateSupportIntent } from './intent';
import type { SupportReferenceEvaluation } from './references';
import {
  finalizeSupportStatus,
  type SupportSlotEvaluation
} from './status';
import type {
  MutableSupportEvaluation,
  SupportEvaluationContext,
  SupportRegionMetrics
} from './contract';

const validateFootHierarchy = (
  slot: AuthoringSlotAssignment,
  support: Extract<AuthoringSupport, { kind: 'foot' }>,
  context: SupportEvaluationContext,
  evaluation: MutableSupportEvaluation
): void => {
  const distalIds = [
    ...support.solePartIds,
    ...support.digits.flatMap((digit) => [
      ...digit.toePartIds,
      ...digit.clawPartIds
    ])
  ];
  const outsideRoot = distalIds.filter(
    (partId) => !isStrictDescendant(partId, support.rootPartId, context.parts)
  );
  if (outsideRoot.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.support_hierarchy_invalid',
      `authoringProfile.slots.${slot.slotId}.support`,
      `Foot regions in slot "${slot.slotId}" are outside the declared foot root hierarchy.`,
      'every sole, toe, and claw part descending from rootPartId',
      outsideRoot
    ), true);
  }
  for (const digit of support.digits) {
    const outsideToe = digit.clawPartIds.filter(
      (clawPartId) => !digit.toePartIds.some(
        (toePartId) => isStrictDescendant(
          clawPartId,
          toePartId,
          context.parts
        )
      )
    );
    if (outsideToe.length === 0) continue;
    addIssue(evaluation, issue(
      'authoring.plan.support_hierarchy_invalid',
      `authoringProfile.slots.${slot.slotId}.support.digits.${digit.digitId}`,
      `Claw regions for digit "${digit.digitId}" do not descend from that digit's toe chain.`,
      'each claw descending from at least one toe part in the same digit',
      outsideToe
    ), true);
  }
};

const evaluateFootDigit = (
  slot: AuthoringSlotAssignment,
  digit: AuthoringFootDigit,
  soleMetrics: SupportRegionMetrics,
  context: SupportEvaluationContext,
  evaluation: MutableSupportEvaluation
): { toeMargin: number | null; clawMargin: number | null } => {
  const toeCells = cellsForParts(digit.toePartIds, context.parts);
  const clawCells = cellsForParts(digit.clawPartIds, context.parts);
  const toeMetrics = regionMetrics(toeCells, context.forward);
  const clawMetrics = regionMetrics(clawCells, context.forward);
  let toeMargin: number | null = null;
  let clawMargin: number | null = null;
  if (toeMetrics) {
    const centroidMargin =
      dot(toeMetrics.centroid, context.forward) -
      dot(soleMetrics.centroid, context.forward);
    const extentMargin = toeMetrics.maximumForward - soleMetrics.maximumForward;
    toeMargin = Math.min(centroidMargin, extentMargin);
    const toeEnvironment = environmentWithout(context.allCells, clawCells);
    if (
      centroidMargin <= EPSILON ||
      extentMargin <= EPSILON ||
      exposedCellCount(toeCells, context.forward, toeEnvironment) === 0
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.support_toe_direction_invalid',
        `authoringProfile.slots.${slot.slotId}.support.digits.${digit.digitId}.toePartIds`,
        `Toe region "${digit.digitId}" does not extend toward the declared project front.`,
        'toe centroid and distal extent ahead of the sole with a forward boundary',
        digit.toePartIds
      ), true);
    }
  }
  if (clawMetrics && toeMetrics) {
    const centroidMargin =
      dot(clawMetrics.centroid, context.forward) -
      dot(toeMetrics.centroid, context.forward);
    const extentMargin = clawMetrics.maximumForward - toeMetrics.maximumForward;
    clawMargin = Math.min(centroidMargin, extentMargin);
    if (
      centroidMargin <= EPSILON ||
      extentMargin <= EPSILON ||
      exposedCellCount(clawCells, context.forward, context.allCells) === 0
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.support_claw_direction_invalid',
        `authoringProfile.slots.${slot.slotId}.support.digits.${digit.digitId}.clawPartIds`,
        `Claw region "${digit.digitId}" does not extend toward the declared project front.`,
        'claw centroid and distal extent ahead of its toe with a forward-exposed tip',
        digit.clawPartIds
      ), true);
    }
  }
  return { toeMargin, clawMargin };
};

export const evaluateFootSupport = (
  slot: AuthoringSlotAssignment,
  support: Extract<AuthoringSupport, { kind: 'foot' }>,
  context: SupportEvaluationContext,
  references: SupportReferenceEvaluation
): SupportSlotEvaluation => {
  const intent = evaluateSupportIntent(slot, support, context);
  const geometry: MutableSupportEvaluation = { issues: [], violations: [] };
  let groundCells = 0;
  let exposedSoleCells = 0;
  const toeMargins: number[] = [];
  const clawMargins: number[] = [];
  if (references.valid) {
    validateFootHierarchy(slot, support, context, geometry);
    const rootCells = cellsForParts([support.rootPartId], context.parts);
    const soleCells = cellsForParts(support.solePartIds, context.parts);
    const rootMetrics = regionMetrics(rootCells, context.forward);
    const soleMetrics = regionMetrics(soleCells, context.forward);
    const downward = { x: 0, y: -1, z: 0 } as const;
    const solePartsWithoutDownwardExposure = support.solePartIds.filter(
      (partId) => exposedCellCount(
        context.parts.get(partId)?.occupancy.cells ?? new Set(),
        downward,
        context.allCells
      ) === 0
    );
    exposedSoleCells = exposedCellCount(
      soleCells,
      downward,
      context.allCells
    );
    if (
      !rootMetrics ||
      !soleMetrics ||
      soleMetrics.centroid[1] >= rootMetrics.centroid[1] - EPSILON ||
      solePartsWithoutDownwardExposure.length > 0
    ) {
      addIssue(geometry, issue(
        'authoring.plan.support_sole_orientation_invalid',
        `authoringProfile.slots.${slot.slotId}.support.solePartIds`,
        `Foot sole in slot "${slot.slotId}" is not a downward-facing region below its root.`,
        'sole occupancy below rootPartId with at least one downward-exposed cell',
        solePartsWithoutDownwardExposure.length > 0
          ? solePartsWithoutDownwardExposure
          : support.solePartIds
      ), true);
    }
    if (support.contact === 'grounded') {
      for (const partId of support.solePartIds) {
        const partCells = context.parts.get(partId)?.occupancy.cells ?? new Set();
        const contacts = groundContactCellCount(partCells);
        const penetrations = belowGroundCellCount(partCells);
        groundCells += contacts;
        if (contacts === 0 || penetrations > 0) {
          addIssue(geometry, issue(
            'authoring.plan.support_ground_contact_invalid',
            `authoringProfile.slots.${slot.slotId}.support.solePartIds`,
            contacts === 0
              ? `Grounded sole part "${partId}" has no canonical contact at lattice y=0.`
              : `Grounded sole part "${partId}" penetrates below lattice y=0 ` +
                `with ${penetrations} canonical cell${penetrations === 1 ? '' : 's'}.`,
            'every grounded sole part owning at least one y=0 cell and no cell below y=0',
            [partId]
          ), true);
        }
      }
    }
    if (soleMetrics) {
      for (const digit of support.digits) {
        const metrics = evaluateFootDigit(
          slot,
          digit,
          soleMetrics,
          context,
          geometry
        );
        if (metrics.toeMargin !== null) toeMargins.push(metrics.toeMargin);
        if (metrics.clawMargin !== null) clawMargins.push(metrics.clawMargin);
      }
    }
  }
  return finalizeSupportStatus(
    slot,
    support,
    references,
    {
      issues: [...intent.issues, ...geometry.issues],
      violations: [...intent.violations, ...geometry.violations]
    },
    {
      groundContactCellCount: groundCells,
      downwardExposedSoleCellCount: exposedSoleCells,
      toeForwardMarginCells: minimumMargin(toeMargins),
      clawForwardMarginCells: minimumMargin(clawMargins)
    }
  );
};
