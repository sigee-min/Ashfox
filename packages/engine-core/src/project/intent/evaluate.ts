import type { ProjectDocument, SceneNode } from '../../model';
import {
  readCompiledParts,
  type CompiledPartState
} from '../../modeling/invariants';
import { isCompiledPartNode } from '../../modeling/provenance';
import { parseCellKey } from '../../modeling/lattice';
import type { CellKey } from '../../modeling/contract';
import {
  isSceneNodeEffectivelyVisible
} from '../../sceneVisibility';
import { measureStaticSupport } from '../../modeling/support/metric';
import { readProjectIntent } from './index';

export type ProjectIntentRequirementCode =
  | 'intent_missing'
  | 'intent_invalid'
  | 'grounding_mismatch'
  | 'grounding_unstable'
  | 'grounding_unverifiable'
  | 'evaluation_unavailable';

export interface ProjectIntentRequirementIssue {
  code: ProjectIntentRequirementCode;
  path: string;
  message: string;
  fix: string;
  entityIds?: readonly string[];
  idsTruncated?: boolean;
}

export interface ProjectIntentRequirementCounts {
  features: number;
  unverifiableGeometry: number;
  groundSupportCells: number;
  projectedFootprintCells: number;
  uniformCenterOfMassSupported: boolean | null;
}

export interface ProjectIntentRequirementReport {
  intentPresent: boolean;
  machineSatisfied: boolean;
  machineChecksComplete: boolean;
  counts: ProjectIntentRequirementCounts;
  issues: readonly ProjectIntentRequirementIssue[];
}

const emptyCounts = (): ProjectIntentRequirementCounts => ({
  features: 0,
  unverifiableGeometry: 0,
  groundSupportCells: 0,
  projectedFootprintCells: 0,
  uniformCenterOfMassSupported: null
});

const ISSUE_ID_LIMIT = 16;

const isRenderableGeometry = (node: SceneNode): boolean =>
  node.kind === 'cube'
    ? Object.values(node.faces).some((face) => face.enabled)
    : node.kind === 'mesh' && Object.keys(node.faces).length > 0;

const visibleForeignGeometryIds = (
  document: ProjectDocument
): readonly string[] =>
  Object.values(document.scene.nodes)
    .filter(
      (node) =>
        isRenderableGeometry(node) &&
        !isCompiledPartNode(node) &&
        isSceneNodeEffectivelyVisible(document, node.id)
    )
    .map((node) => node.id)
    .sort();

const compiledCellKeys = function* (
  parts: ReadonlyMap<string, CompiledPartState>
): Generator<CellKey, void, unknown> {
  for (const part of parts.values()) {
    yield* part.occupancy.cells;
  }
};

export interface ProjectGroundingCorrection {
  rootPartId: string;
  by: readonly [0, number, 0];
}

export const projectGroundingCorrection = (
  document: ProjectDocument
): ProjectGroundingCorrection | null => {
  const intent = readProjectIntent(document);
  if (
    !intent.ok ||
    intent.intent === null ||
    intent.intent.grounding === 'free-explicit'
  ) {
    return null;
  }
  const compiled = readCompiledParts(document);
  if (!compiled.ok) return null;
  const roots = [...compiled.parts.values()].filter(
    (part) => part.parentPartId === null
  );
  if (roots.length !== 1) return null;
  let minimumY: number | null = null;
  for (const part of compiled.parts.values()) {
    for (const key of part.occupancy.cells) {
      const y = parseCellKey(key).y;
      minimumY = minimumY === null ? y : Math.min(minimumY, y);
    }
  }
  if (minimumY === null) return null;
  const offset =
    intent.intent.grounding === 'grounded'
      ? -minimumY
      : minimumY > 0
        ? 0
        : 1 - minimumY;
  return offset === 0
    ? null
    : {
        rootPartId: roots[0].partId,
        by: [0, offset, 0]
      };
};

export const evaluateProjectIntentRequirements = (
  document: ProjectDocument
): ProjectIntentRequirementReport => {
  const intentResult = readProjectIntent(document);
  if (!intentResult.ok) {
    const issuePath = intentResult.issues[0]?.path ?? 'intent';
    return {
      intentPresent: document.intent !== undefined,
      machineSatisfied: false,
      machineChecksComplete: false,
      counts: emptyCounts(),
      issues: [{
        code: 'intent_invalid',
        path:
          issuePath === 'intent' || issuePath.startsWith('intent.')
            ? issuePath
            : `intent.${issuePath}`,
        message:
          intentResult.issues[0]?.message ??
          'Persisted project intent is invalid.',
        fix: 'Correct and recompile the authoritative Intent Program source.'
      }]
    };
  }
  const intent = intentResult.intent;
  if (intent === null) {
    return {
      intentPresent: false,
      machineSatisfied: false,
      machineChecksComplete: false,
      counts: emptyCounts(),
      issues: [{
        code: 'intent_missing',
        path: 'intent',
        message: 'The project has no subject intent.',
        fix: 'Have the Agent submit one complete coordinate-free Intent Program for compilation.'
      }]
    };
  }

  const baseCounts: ProjectIntentRequirementCounts = {
    ...emptyCounts(),
    features: intent.features.length
  };
  if (intent.grounding === 'free-explicit') {
    return {
      intentPresent: true,
      machineSatisfied: true,
      machineChecksComplete: true,
      counts: baseCounts,
      issues: []
    };
  }

  const issues: ProjectIntentRequirementIssue[] = [];
  let machineChecksComplete = true;
  const compiledResult = readCompiledParts(document);
  const compiled = compiledResult.ok
    ? compiledResult.parts
    : null;
  if (!compiled) {
    machineChecksComplete = false;
    const entityIds = compiledResult.ok
      ? []
      : compiledResult.issues.flatMap((issue) => issue.entityIds);
    issues.push({
      code: 'evaluation_unavailable',
      path:
        compiledResult.ok
          ? 'scene.parts'
          : compiledResult.issues[0]?.path ?? 'scene.parts',
      message:
        'Grounding cannot be evaluated because canonical part geometry is invalid.',
      ...(entityIds.length > 0
        ? {
            entityIds: entityIds.slice(0, ISSUE_ID_LIMIT),
            idsTruncated: entityIds.length > ISSUE_ID_LIMIT
          }
        : {}),
      fix: 'Correct and recompile the authoritative Intent Program source.'
    });
  }

  const foreignGeometryIds = visibleForeignGeometryIds(document);
  if (foreignGeometryIds.length > 0) {
    machineChecksComplete = false;
    issues.push({
      code: 'grounding_unverifiable',
      path: 'intent.grounding',
      message:
        `${foreignGeometryIds.length} visible renderable node(s) exist outside canonical part occupancy.`,
      entityIds: foreignGeometryIds.slice(0, ISSUE_ID_LIMIT),
      idsTruncated: foreignGeometryIds.length > ISSUE_ID_LIMIT,
      fix: 'Compile one complete Intent Program; arbitrary external geometry is not part of this workflow.'
    });
  }

  const staticSupport = compiled
    ? measureStaticSupport(compiledCellKeys(compiled))
    : null;
  if (compiled) {
    let minimumY: number | null = null;
    for (const part of compiled.values()) {
      for (const key of part.occupancy.cells) {
        const y = parseCellKey(key).y;
        minimumY = minimumY === null
          ? y
          : Math.min(minimumY, y);
      }
    }
    const groundingMatches =
      intent.grounding === 'grounded'
        ? minimumY === 0
        : minimumY !== null && minimumY > 0;
    if (!groundingMatches) {
      issues.push({
        code: 'grounding_mismatch',
        path: 'intent.grounding',
        message:
          intent.grounding === 'grounded'
            ? `Grounded intent requires minimum lattice y=0; found ${String(minimumY)}.`
            : `Contact-free intent requires minimum lattice y>0; found ${String(minimumY)}.`,
        fix:
          'Choose the appropriate neutral rest declaration and recompile the Intent Program.'
      });
    } else if (
      intent.grounding === 'grounded' &&
      staticSupport?.stable === false
    ) {
      issues.push({
        code: 'grounding_unstable',
        path: 'intent.grounding',
        message:
          'The uniform-volume center of mass falls outside the ground-contact support hull.',
        fix: 'Adjust the high-level body or rest declaration and recompile the Intent Program.'
      });
    }
  }

  return {
    intentPresent: true,
    machineSatisfied: issues.length === 0,
    machineChecksComplete,
    counts: {
      features: intent.features.length,
      unverifiableGeometry: foreignGeometryIds.length,
      groundSupportCells:
        staticSupport?.supportCellCount ?? 0,
      projectedFootprintCells:
        staticSupport?.projectedFootprintCellCount ?? 0,
      uniformCenterOfMassSupported:
        intent.grounding === 'grounded'
          ? staticSupport?.stable ?? null
          : null
    },
    issues
  };
};
