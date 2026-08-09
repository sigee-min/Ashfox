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

export const evaluateBaseSupport = (
  slot: AuthoringSlotAssignment,
  support: Extract<AuthoringSupport, { kind: 'base' }>,
  context: SupportEvaluationContext,
  references: SupportReferenceEvaluation
): SupportSlotEvaluation => {
  const intent = evaluateSupportIntent(slot, support, context);
  const geometry: MutableSupportEvaluation = { issues: [], violations: [] };
  let groundCells = 0;
  if (references.valid && support.contact === 'grounded') {
    for (const partId of support.supportPartIds) {
      const partCells = context.parts.get(partId)?.occupancy.cells ?? new Set();
      const contacts = groundContactCellCount(partCells);
      const penetrations = belowGroundCellCount(partCells);
      groundCells += contacts;
      if (contacts === 0 || penetrations > 0) {
        addIssue(geometry, issue(
          'authoring.plan.support_ground_contact_invalid',
          `authoringProfile.slots.${slot.slotId}.support.supportPartIds`,
          contacts === 0
            ? `Base support part "${partId}" has no canonical contact at lattice y=0.`
            : `Base support part "${partId}" penetrates below lattice y=0 ` +
              `with ${penetrations} canonical cell${penetrations === 1 ? '' : 's'}.`,
          'every grounded base part owning at least one y=0 cell and no cell below y=0',
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
