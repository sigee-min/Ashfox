import type {
  AuthoringSlotAssignment,
  AuthoringSupport
} from '../../contract';
import {
  addSupportQualityIssue as addIssue,
  belowGroundCellCount,
  groundContactCellCount,
  supportQualityIssue as issue
} from './geometry';
import { evaluateSupportIntent } from './intent';
import type { SupportReferenceEvaluation } from './references';
import {
  finalizeSupportStatus,
  type SupportSlotEvaluation
} from './status';
import type {
  MutableSupportEvaluation,
  SupportEvaluationContext
} from './contract';

/** Validates a real radial rolling contact, not a base masquerading as a wheel. */
export const evaluateWheelSupport = (
  slot: AuthoringSlotAssignment,
  support: Extract<AuthoringSupport, { kind: 'wheel' }>,
  context: SupportEvaluationContext,
  references: SupportReferenceEvaluation
): SupportSlotEvaluation => {
  const intent = evaluateSupportIntent(slot, support, context);
  const geometry: MutableSupportEvaluation = { issues: [], violations: [] };
  let groundCells = 0;
  if (references.valid) {
    for (const partId of support.wheelPartIds) {
      const part = context.parts.get(partId);
      const cells = part?.occupancy.cells ?? new Set();
      const contacts = groundContactCellCount(cells);
      const penetrations = belowGroundCellCount(cells);
      groundCells += contacts;
      if (
        part?.primitive !== 'radial' ||
        part.joint.kind !== 'hinge' ||
        part.joint.axis !== context.frame.lateralAxis
      ) {
        addIssue(geometry, issue(
          'authoring.plan.support_wheel_primitive_invalid',
          `authoringProfile.slots.${slot.slotId}.support.wheelPartIds`,
          `Wheel support part "${partId}" is not a lateral-axis hinged radial primitive.`,
          'one radial primitive with a hinge around the project lateral axis',
          [partId]
        ), true);
      }
      if (support.contact === 'grounded' && (contacts === 0 || penetrations > 0)) {
        addIssue(geometry, issue(
          'authoring.plan.support_ground_contact_invalid',
          `authoringProfile.slots.${slot.slotId}.support.wheelPartIds`,
          contacts === 0
            ? `Rolling wheel "${partId}" has no canonical contact at lattice y=0.`
            : `Rolling wheel "${partId}" penetrates below lattice y=0 ` +
              `with ${penetrations} canonical cell${penetrations === 1 ? '' : 's'}.`,
          'every grounded wheel owning at least one y=0 cell and no cell below y=0',
          [partId]
        ), true);
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
      downwardExposedSoleCellCount: 0,
      toeForwardMarginCells: null,
      clawForwardMarginCells: null
    }
  );
};
