import type { ProjectDocument, SceneNode } from '../model';
import {
  readCompiledParts,
  type CompiledPartState
} from '../modeling/partInvariants';
import { parseCellKey } from '../modeling/lattice';
import type { CellKey } from '../modeling/types';
import { readPartRecipe } from '../modeling/partRecipe';
import {
  areLatticeCellSetsExactReflections
} from '../modeling/partRecipeTransforms';
import { isCompiledPartNode } from '../modeling/provenance';
import {
  isSceneNodeEffectivelyVisible
} from '../sceneVisibility';
import { measureStaticSupport } from '../modeling/staticSupportMetric';
import { readProjectIntent } from './projectIntent';

export type ProjectIntentRequirementCode =
  | 'intent_missing'
  | 'intent_invalid'
  | 'required_part_missing'
  | 'required_material_missing'
  | 'required_clip_missing'
  | 'required_clip_channels_missing'
  | 'grounding_mismatch'
  | 'grounding_unstable'
  | 'grounding_unverifiable'
  | 'symmetry_part_missing'
  | 'symmetry_mismatch'
  | 'evaluation_unavailable';

export interface ProjectIntentRequirementIssue {
  code: ProjectIntentRequirementCode;
  path: string;
  message: string;
  fix: string;
  partIds?: readonly string[];
  materialIds?: readonly string[];
  clipIds?: readonly string[];
  entityIds?: readonly string[];
  idsTruncated?: boolean;
}

export interface ProjectIntentRequirementCounts {
  requiredFeatures: number;
  requiredParts: number;
  missingParts: number;
  requiredMaterials: number;
  missingMaterials: number;
  requiredClips: number;
  missingClips: number;
  emptyRequiredClips: number;
  unverifiableGeometry: number;
  groundSupportCells: number;
  projectedFootprintCells: number;
  uniformCenterOfMassSupported: boolean | null;
  symmetryPairs: number;
  symmetryMismatches: number;
  symmetryUnevaluated: number;
}

export interface ProjectIntentRequirementReport {
  intentPresent: boolean;
  machineSatisfied: boolean;
  machineChecksComplete: boolean;
  counts: ProjectIntentRequirementCounts;
  issues: readonly ProjectIntentRequirementIssue[];
}

const emptyCounts = (): ProjectIntentRequirementCounts => ({
  requiredFeatures: 0,
  requiredParts: 0,
  missingParts: 0,
  requiredMaterials: 0,
  missingMaterials: 0,
  requiredClips: 0,
  missingClips: 0,
  emptyRequiredClips: 0,
  unverifiableGeometry: 0,
  groundSupportCells: 0,
  projectedFootprintCells: 0,
  uniformCenterOfMassSupported: null,
  symmetryPairs: 0,
  symmetryMismatches: 0,
  symmetryUnevaluated: 0
});

const ISSUE_ID_LIMIT = 16;

const boundedIds = (ids: readonly string[]): readonly string[] =>
  ids.slice(0, ISSUE_ID_LIMIT);

const idSummary = (ids: readonly string[]): string =>
  [
    boundedIds(ids).join(', '),
    ids.length > ISSUE_ID_LIMIT
      ? `(+${ids.length - ISSUE_ID_LIMIT} more)`
      : ''
  ].filter((value) => value.length > 0).join(' ');

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
        fix:
          'Set a normalized objective contract through project.intent.set.'
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
        message:
          'The project has no persisted build and review intent.',
        fix:
          'Set subject, orientation, grounding, review features, and required IDs before modeling.'
      }]
    };
  }

  const issues: ProjectIntentRequirementIssue[] = [];
  const recipeResult = readPartRecipe(document);
  const partIds = new Set(
    recipeResult.ok && recipeResult.recipe
      ? recipeResult.recipe.parts.map((part) => part.partId)
      : []
  );
  const materialIds = new Set(
    recipeResult.ok && recipeResult.recipe
      ? recipeResult.recipe.materials.map((material) => material.id)
      : []
  );
  const missingParts = intent.requiredPartIds.filter(
    (id) => !partIds.has(id)
  );
  const missingMaterials = intent.requiredMaterialIds.filter(
    (id) => !materialIds.has(id)
  );
  const missingClips = intent.requiredClipIds.filter(
    (id) =>
      !Object.prototype.hasOwnProperty.call(
        document.animations,
        id
      )
  );
  const emptyRequiredClips = intent.requiredClipIds.filter((id) => {
    if (
      !Object.prototype.hasOwnProperty.call(
        document.animations,
        id
      )
    ) {
      return false;
    }
    const clip = document.animations[id];
    return clip !== undefined &&
      Object.keys(clip.channels).length === 0;
  });
  if (missingParts.length > 0) {
    issues.push({
      code: 'required_part_missing',
      path: 'intent.requiredPartIds',
      message:
        `Required part IDs are missing: ${idSummary(missingParts)}.`,
      partIds: boundedIds(missingParts),
      idsTruncated: missingParts.length > ISSUE_ID_LIMIT,
      fix:
        'Create every required canonical part ID through model.parts.upsert.'
    });
  }
  if (missingMaterials.length > 0) {
    issues.push({
      code: 'required_material_missing',
      path: 'intent.requiredMaterialIds',
      message:
        `Required material IDs are missing: ${idSummary(missingMaterials)}.`,
      materialIds: boundedIds(missingMaterials),
      idsTruncated: missingMaterials.length > ISSUE_ID_LIMIT,
      fix:
        'Create and assign every required material through the canonical part recipe.'
    });
  }
  if (missingClips.length > 0) {
    issues.push({
      code: 'required_clip_missing',
      path: 'intent.requiredClipIds',
      message:
        `Required clip IDs are missing: ${idSummary(missingClips)}.`,
      clipIds: boundedIds(missingClips),
      idsTruncated: missingClips.length > ISSUE_ID_LIMIT,
      fix:
        'Create every required animation clip with its exact persisted ID.'
    });
  }
  if (emptyRequiredClips.length > 0) {
    issues.push({
      code: 'required_clip_channels_missing',
      path: 'intent.requiredClipIds',
      message:
        `Required clips have no transform channels: ` +
        `${idSummary(emptyRequiredClips)}.`,
      clipIds: boundedIds(emptyRequiredClips),
      idsTruncated:
        emptyRequiredClips.length > ISSUE_ID_LIMIT,
      fix:
        'Author at least one transform channel for every required animation clip.'
    });
  }

  const compiledResult = readCompiledParts(document);
  const compiled = compiledResult.ok
    ? compiledResult.parts
    : null;
  const objectiveGeometryRequired =
    intent.grounding !== 'free' ||
    (intent.symmetryPairs?.length ?? 0) > 0;
  let machineChecksComplete = true;
  let evaluationUnavailableReported = false;
  const reportEvaluationUnavailable = (
    path: string,
    message: string,
    entityIds?: readonly string[]
  ): void => {
    machineChecksComplete = false;
    if (evaluationUnavailableReported) return;
    evaluationUnavailableReported = true;
    issues.push({
      code: 'evaluation_unavailable',
      path,
      message,
      ...(entityIds
        ? {
            entityIds: boundedIds(entityIds),
            idsTruncated: entityIds.length > ISSUE_ID_LIMIT
          }
        : {}),
      fix:
        'Restore a valid canonical part projection before evaluating objective geometry requirements.'
    });
  };
  if (!compiled && objectiveGeometryRequired) {
    reportEvaluationUnavailable(
      compiledResult.ok
        ? 'scene.parts'
        : compiledResult.issues[0]?.path ?? 'scene.parts',
      'Objective grounding or symmetry cannot be evaluated because canonical part geometry is invalid.',
      compiledResult.ok
        ? undefined
        : compiledResult.issues.flatMap(
            (issue) => issue.entityIds
          )
    );
  }

  const foreignGeometryIds =
    intent.grounding === 'free'
      ? []
      : visibleForeignGeometryIds(document);
  if (foreignGeometryIds.length > 0) {
    machineChecksComplete = false;
    issues.push({
      code: 'grounding_unverifiable',
      path: 'intent.grounding',
      message:
        `${foreignGeometryIds.length} visible renderable node(s) exist outside canonical part occupancy, so complete-model grounding cannot be verified.`,
      entityIds: boundedIds(foreignGeometryIds),
      idsTruncated:
        foreignGeometryIds.length > ISSUE_ID_LIMIT,
      fix:
        'Convert visible renderable geometry to canonical model parts, remove it, hide it, or declare grounding as free.'
    });
  }
  const staticSupport = compiled
    ? measureStaticSupport(compiledCellKeys(compiled))
    : null;
  if (compiled && intent.grounding !== 'free') {
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
            : `Airborne intent requires minimum lattice y>0; found ${String(minimumY)}.`,
        fix:
          intent.grounding === 'grounded'
            ? 'Translate the complete model so its lowest occupied lattice cell begins at y=0.'
            : 'Translate the complete model so every occupied lattice cell begins above y=0.'
      });
    } else if (
      intent.grounding === 'grounded' &&
      staticSupport?.stable === false
    ) {
      issues.push({
        code: 'grounding_unstable',
        path: 'intent.grounding',
        message:
          'The uniform-volume center of mass falls outside the convex hull of the ground-contact cells.',
        fix:
          'Widen or reposition ground contacts, or rebalance occupied volume so its projected center lies inside the support hull.'
      });
    }
  }

  let symmetryMismatches = 0;
  let symmetryUnevaluated = 0;
  for (const [index, pair] of (
    intent.symmetryPairs ?? []
  ).entries()) {
    const missingPairParts = [
      ...(partIds.has(pair.leftPartId) ? [] : [pair.leftPartId]),
      ...(partIds.has(pair.rightPartId) ? [] : [pair.rightPartId])
    ];
    if (missingPairParts.length > 0) {
      issues.push({
        code: 'symmetry_part_missing',
        path: `intent.symmetryPairs[${index}]`,
        message:
          `Symmetry parts are unavailable: ${missingPairParts.join(', ')}.`,
        partIds: missingPairParts,
        fix:
          'Create both named parts before evaluating their exact lattice reflection.'
      });
      symmetryMismatches += 1;
      continue;
    }
    if (!compiled) {
      symmetryUnevaluated += 1;
      continue;
    }
    const left = compiled.get(pair.leftPartId);
    const right = compiled.get(pair.rightPartId);
    if (!left || !right) {
      symmetryUnevaluated += 1;
      reportEvaluationUnavailable(
        `intent.symmetryPairs[${index}]`,
        'Declared symmetry parts exist in the recipe but are unavailable in canonical compiled geometry.',
        [
          ...(left ? [] : [pair.leftPartId]),
          ...(right ? [] : [pair.rightPartId])
        ]
      );
      continue;
    }
    if (
      !areLatticeCellSetsExactReflections(
        left.occupancy.cells,
        right.occupancy.cells,
        pair.axis,
        pair.plane
      )
    ) {
      issues.push({
        code: 'symmetry_mismatch',
        path: `intent.symmetryPairs[${index}]`,
        message:
          `Parts "${pair.leftPartId}" and "${pair.rightPartId}" ` +
          `are not exact lattice reflections across ${pair.axis}=${pair.plane}.`,
        partIds: [pair.leftPartId, pair.rightPartId],
        fix:
          'Mirror the complete source part occupancy across the declared lattice plane.'
      });
      symmetryMismatches += 1;
    }
  }

  return {
    intentPresent: true,
    machineSatisfied: issues.length === 0,
    machineChecksComplete,
    counts: {
      requiredFeatures: intent.requiredFeatures.length,
      requiredParts: intent.requiredPartIds.length,
      missingParts: missingParts.length,
      requiredMaterials: intent.requiredMaterialIds.length,
      missingMaterials: missingMaterials.length,
      requiredClips: intent.requiredClipIds.length,
      missingClips: missingClips.length,
      emptyRequiredClips: emptyRequiredClips.length,
      unverifiableGeometry: foreignGeometryIds.length,
      groundSupportCells:
        staticSupport?.supportCellCount ?? 0,
      projectedFootprintCells:
        staticSupport?.projectedFootprintCellCount ?? 0,
      uniformCenterOfMassSupported:
        intent.grounding === 'grounded'
          ? staticSupport?.stable ?? null
          : null,
      symmetryPairs: intent.symmetryPairs?.length ?? 0,
      symmetryMismatches,
      symmetryUnevaluated
    },
    issues
  };
};
