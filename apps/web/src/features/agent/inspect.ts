import {
  attachmentContactMetrics,
  CANONICAL_IDLE_CLIP_ID,
  canonicalizePartOccupancies,
  evaluateProductionReadiness,
  exportCompatibilityOptions,
  getAgentCommandDefinition,
  isSceneNodeEffectivelyVisible,
  orthographicContributionMetrics,
  projectSpacePartAuthoringSpec,
  readCompiledParts,
  readPartRecipe,
  type CommandReceipt,
  type ExportCompatibilityOption,
  type MinecraftGameVersion,
  type PartSpec,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import { boundedSuccess } from './boundedResult';
import { agentCommandProtocol } from './agentCommandProtocol';
import { deriveInspectWorkflow } from './inspectWorkflow';
import { inspectClipAuthoring } from './inspectClip';
import type {
  VisualReviewReceipt
} from './presentationReview';
import { schemaHash } from './schemaHash';
import {
  evaluateAssetMaterialization
} from '../files/assetMaterialization';
import {
  editableProjectTargetFor,
  projectGameVersionOptionsFor,
  projectExportTargetFor
} from '../../application/projectExportTarget';
import type {
  ProjectAssets
} from '../../application/projectAssets';
import type {
  InspectRequest,
  InspectResult
} from './types';

const DEFAULT_LIMIT = 2048;
const DETAIL_LIMIT = 16_384;
const ID_LIMIT = 10;
const CATALOG_PAGE_LIMIT = 50;
const ACTIVITY_PAGE_LIMIT = 20;
const MATERIALIZATION_ISSUE_LIMIT = 20;

const exportCompatibilitySummary = (
  document: ProjectDocument
): {
  gameVersion: MinecraftGameVersion | null;
  animationSupport: ExportCompatibilityOption['animationSupport'] | null;
  supportedGameVersions: readonly {
    version: MinecraftGameVersion;
    label: string;
    isDefaultVersion: boolean;
  }[];
} => {
  const target = editableProjectTargetFor(document);
  const options = target === null
    ? []
    : exportCompatibilityOptions(target.target);
  const selected = target === null
    ? null
    : options.find(
        (option) => option.gameVersion === target.gameVersion
      ) ?? options.find((option) => option.isDefaultVersion) ?? null;
  return {
    gameVersion: target?.gameVersion ?? null,
    animationSupport: selected?.animationSupport ?? null,
    supportedGameVersions: target === null
      ? []
      : projectGameVersionOptionsFor(target.target).map((option) => ({
          version: option.value,
          label: option.label,
          isDefaultVersion: option.isDefaultVersion
        }))
  };
};

const invalidRequest = (
  revision: string,
  path: string,
  expected: string
): InspectResult => ({
  ok: false,
  revision,
  error: {
    code: 'invalid_request',
    path,
    expected
  }
});

const selectedValues = <T>(
  record: Readonly<Record<string, T>>,
  ids: readonly string[]
): readonly T[] =>
  ids
    .slice(0, ID_LIMIT)
    .map((id) => record[id])
    .filter((value): value is T => value !== undefined);

const missingRecordId = <T>(
  record: Readonly<Record<string, T>>,
  ids: readonly string[]
): { id: string; index: number } | null => {
  const index = ids.findIndex(
    (id) => record[id] === undefined
  );
  return index < 0 ? null : { id: ids[index], index };
};

const missingPartId = (
  document: ProjectDocument,
  ids: readonly string[]
): { id: string; index: number } | null => {
  const recipe = readPartRecipe(document);
  const known = new Set(
    recipe.ok && recipe.recipe
      ? recipe.recipe.parts.map((part) => part.partId)
      : []
  );
  const index = ids.findIndex((id) => !known.has(id));
  return index < 0 ? null : { id: ids[index], index };
};

const authoringPartSpec = (
  spec: PartSpec | undefined
) => spec ? projectSpacePartAuthoringSpec(spec) : null;

const compiledPartSummaries = (
  document: ProjectDocument,
  ids: readonly string[],
  report: ValidationReport
): unknown => {
  const compiled = readCompiledParts(document);
  if (!compiled.ok) {
    return {
      valid: false,
      firstIssue: compiled.issues[0] ?? null
    };
  }
  const recipe = readPartRecipe(document);
  if (!recipe.ok) {
    return {
      valid: false,
      firstIssue: recipe.issues[0] ?? null
    };
  }
  const specs = new Map(
    (recipe.recipe?.parts ?? []).map(
      (spec) => [spec.partId, spec]
    )
  );
  const materials = new Map(
    (recipe.recipe?.materials ?? []).map(
      (material) => [material.id, material]
    )
  );
  const canonicalized = recipe.recipe === null
    ? { ok: true as const, parts: [] }
    : canonicalizePartOccupancies(
        recipe.recipe.parts,
        document.settings.surfacePixelDensity
      );
  if (!canonicalized.ok) {
    return {
      valid: false,
      firstIssue: {
        path: `modeling.${canonicalized.path}`,
        message: canonicalized.message
      }
    };
  }
  const canonicalizationByPart = new Map(
    canonicalized.parts.map((part) => [
      part.spec.partId,
      part.metric
    ])
  );
  const contactByPart = new Map(
    attachmentContactMetrics(compiled.parts).map((metric) => [
      metric.partId,
      metric
    ])
  );
  const projectionByPart = new Map<string, unknown[]>();
  for (const metric of orthographicContributionMetrics(compiled.parts)) {
    const entries = projectionByPart.get(metric.partId) ?? [];
    entries.push(metric);
    projectionByPart.set(metric.partId, entries);
  }
  const projectionFinding = report.findings.find(
    (finding) =>
      finding.severity === 'error' &&
      finding.code === 'model.part_projection'
  );
  return {
    valid: projectionFinding === undefined,
    firstIssue: projectionFinding ?? null,
    parts: ids
      .map((id): unknown => {
        const spec = specs.get(id);
        if (!spec) return null;
        if (spec.kind === 'feature') {
          return {
            partId: spec.partId,
            parentPartId: spec.parentPartId,
            materialId: spec.materialId,
            primitive: spec.kind,
            joint: spec.joint,
            spec: authoringPartSpec(spec),
            material: materials.get(spec.materialId) ?? null,
            projection: {
              kind: 'surface',
              motif: spec.motif,
              face: spec.face,
              anchor: spec.anchor,
              size: spec.size
            },
            boneId: null,
            cubeCount: 0,
            modelBounds: null,
            canonicalization: null,
            attachmentContact: null,
            orthographicContribution: []
          };
        }
        const part = compiled.parts.get(id);
        if (!part) return null;
        const from = [0, 1, 2].map((axis) =>
          Math.min(
            ...part.cubes.map((cube) => cube.bounds.from[axis])
          )
        );
        const to = [0, 1, 2].map((axis) =>
          Math.max(
            ...part.cubes.map((cube) => cube.bounds.to[axis])
          )
        );
        return {
          partId: part.partId,
          parentPartId: part.parentPartId,
          materialId: part.materialId,
          primitive: part.primitive,
          joint: part.joint,
          spec: authoringPartSpec(spec),
          material:
            materials.get(part.materialId) ?? null,
          boneId: part.bone.id,
          cubeCount: part.cubes.length,
          modelBounds: { from, to },
          canonicalization:
            canonicalizationByPart.get(part.partId) ?? null,
          attachmentContact: contactByPart.get(part.partId) ?? null,
          orthographicContribution:
            projectionByPart.get(part.partId) ?? []
        };
      })
      .filter((part) => part !== null)
  };
};

const pageOffset = (
  cursor: string | undefined,
  kind: 'catalog' | 'activity',
  scope: string
): number | null => {
  if (cursor === undefined) return 0;
  const match = cursor.match(
    new RegExp(`^${kind}:${scope}:([0-9a-z]+)$`)
  );
  if (!match) return null;
  const offset = Number.parseInt(match[1], 36);
  return Number.isSafeInteger(offset) && offset >= 0
    ? offset
    : null;
};

const inspectCatalog = (
  document: ProjectDocument,
  cursor: string | undefined,
  limit = CATALOG_PAGE_LIMIT
): unknown | null => {
  const scope = schemaHash({
    projectId: document.id,
    revision: document.revision
  }).split(':')[1];
  const offset = pageOffset(cursor, 'catalog', scope);
  if (offset === null) return null;
  const recipe = readPartRecipe(document);
  const entries = [
    ...(
      recipe.ok && recipe.recipe
        ? recipe.recipe.parts
          .map((part) => part.partId)
          .sort()
          .map((id) => ({ kind: 'part' as const, id }))
        : []
    ),
    ...Object.keys(document.textures)
      .sort()
      .map((id) => ({ kind: 'texture' as const, id })),
    ...Object.keys(document.animations)
      .sort()
      .map((id) => ({ kind: 'clip' as const, id }))
  ];
  const items = entries.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    items,
    total: entries.length,
    counts: {
      parts: entries.filter((entry) => entry.kind === 'part').length,
      textures: entries.filter((entry) => entry.kind === 'texture').length,
      clips: entries.filter((entry) => entry.kind === 'clip').length
    },
    nextCursor:
      nextOffset < entries.length
        ? `catalog:${scope}:${nextOffset.toString(36)}`
        : null
  };
};

const inspectActivity = (
  document: ProjectDocument,
  activity: readonly CommandReceipt[],
  cursor: string | undefined,
  limit = ACTIVITY_PAGE_LIMIT
): unknown | null => {
  const scope = schemaHash({
    projectId: document.id,
    revision: document.revision
  }).split(':')[1];
  const offset = pageOffset(cursor, 'activity', scope);
  if (offset === null) return null;
  const items = activity
    .slice(offset, offset + limit)
    .map((receipt) => ({
      commandId: receipt.commandId,
      projectId: receipt.projectId,
      actorId: receipt.actorId,
      source: receipt.source,
      summary: receipt.summary.slice(0, 500),
      beforeRevision: receipt.beforeRevision,
      revision: receipt.revision,
      completedAt: receipt.completedAt,
      durationMs: receipt.durationMs,
      effects: {
        created: receipt.effects.createdEntityIds.length,
        changed: receipt.effects.changedEntityIds.length,
        removed: receipt.effects.removedEntityIds.length,
        invalidated: receipt.effects.invalidated
      },
      findings: {
        errors: receipt.findings.filter(
          (finding) => finding.severity === 'error'
        ).length,
        warnings: receipt.findings.filter(
          (finding) => finding.severity === 'warning'
        ).length
      }
    }));
  const nextOffset = offset + items.length;
  return {
    items,
    total: activity.length,
    nextCursor:
      nextOffset < activity.length
        ? `activity:${scope}:${nextOffset.toString(36)}`
        : null
  };
};

const inspectDefault = (
  document: ProjectDocument,
  selectedNodeId: string | null,
  report: ValidationReport,
  visualReviews: readonly VisualReviewReceipt[],
  operationOwner: string | null
): InspectResult => {
  const nodes = Object.values(document.scene.nodes);
  const clips = Object.values(document.animations);
  const readiness = evaluateProductionReadiness(document, report);
  const workflow = deriveInspectWorkflow(
    document,
    report,
    readiness,
    visualReviews
  );
  const idleClip =
    document.animations[CANONICAL_IDLE_CLIP_ID];
  const exportTarget = projectExportTargetFor(document);
  const compatibility = exportCompatibilitySummary(document);
  return boundedSuccess(
    document.revision,
    {
      commandPort: {
        status: operationOwner === null ? 'connected' : 'working',
        operation: operationOwner
      },
      protocol: {
        workbench: agentCommandProtocol.workbench,
        manifest: agentCommandProtocol.href,
        commandSchema: {
          kind: 'command',
          name: '<commands entry>'
        }
      },
      project: {
        id: document.id,
        name: document.name.slice(0, 120),
        revision: document.revision,
        subject: document.intent?.subject ?? null,
        forward: document.intent?.forward ?? null,
        grounding: document.intent?.grounding ?? null,
        target: exportTarget.target,
        gameVersion: compatibility.gameVersion,
        animationSupport: compatibility.animationSupport,
        supportedGameVersions:
          compatibility.supportedGameVersions,
        profileId: document.formatProfile.id,
        structurallyValid: readiness.structurallyValid,
        mechanicallyReady: readiness.mechanicallyReady,
        semanticReviewRequired:
          readiness.semanticReviewRequired,
        surfacePixelDensity:
          document.settings.surfacePixelDensity,
        textureResolution:
          document.settings.textureResolution
      },
      selection: selectedNodeId,
      counts: {
        nodes: nodes.length,
        parts: new Set(
          nodes.flatMap((node) =>
            node.generation?.authority === 'ashfox.part-compiler'
              ? [node.generation.partId]
              : []
          )
        ).size,
        bones: nodes.filter((node) => node.kind === 'bone').length,
        cubes: nodes.filter((node) => node.kind === 'cube').length,
        visibleCubes: nodes.filter(
          (node) =>
            node.kind === 'cube' &&
            isSceneNodeEffectivelyVisible(document, node.id)
        ).length,
        meshes: nodes.filter((node) => node.kind === 'mesh').length,
        locators: nodes.filter((node) => node.kind === 'locator').length,
        enabledVisibleFaces: readiness.counts.enabledVisibleFaces,
        texturedVisibleFaces: readiness.counts.texturedVisibleFaces,
        untexturedVisibleFaces:
          readiness.counts.untexturedVisibleFaces,
        textures: Object.keys(document.textures).length,
        clips: clips.length,
        channels: clips.reduce(
          (count, clip) => count + Object.keys(clip.channels).length,
          0
        ),
        triggers: clips.reduce(
          (count, clip) => count + Object.keys(clip.triggers).length,
          0
        ),
        idleClips: idleClip ? 1 : 0,
        idleChannels:
          idleClip ? Object.keys(idleClip.channels).length : 0
      },
      workflow
    },
    DEFAULT_LIMIT
  );
};

export const inspectProject = (
  document: ProjectDocument,
  selectedNodeId: string | null,
  report: ValidationReport,
  request?: InspectRequest,
  activity: readonly CommandReceipt[] = [],
  assets: ProjectAssets = {},
  visualReviews: readonly VisualReviewReceipt[] = [],
  operationOwner: string | null = null
): InspectResult => {
  if (!request) {
    return inspectDefault(
      document,
      selectedNodeId,
      report,
      visualReviews,
      operationOwner
    );
  }

  switch (request.kind) {
    case 'command': {
      const definition = getAgentCommandDefinition(request.name);
      if (!definition) {
        return {
          ok: false,
          revision: document.revision,
          error: {
            code: 'not_found',
            path: 'name',
            expected: 'registered command'
          }
        };
      }
      return boundedSuccess(
        document.revision,
        {
          name: definition.name,
          label: definition.label,
          purpose: definition.purpose,
          schemaHash: schemaHash(definition.inputSchema),
          inputSchema: definition.inputSchema
        },
        DETAIL_LIMIT
      );
    }
    case 'catalog': {
      const catalog = inspectCatalog(
        document,
        request.cursor,
        request.limit
      );
      if (catalog === null) {
        return invalidRequest(
          document.revision,
          'cursor',
          'catalog page cursor from the previous response'
        );
      }
      return boundedSuccess(
        document.revision,
        catalog,
        DETAIL_LIMIT
      );
    }
    case 'parts':
      if (request.ids.length > ID_LIMIT) {
        return invalidRequest(
          document.revision,
          'ids',
          `at most ${ID_LIMIT} part IDs`
        );
      }
      {
        const missing = missingPartId(document, request.ids);
        if (missing) {
          return {
            ok: false,
            revision: document.revision,
            error: {
              code: 'not_found',
              path: `ids[${missing.index}]`,
              expected: 'existing canonical part ID'
            }
          };
        }
      }
      return boundedSuccess(
        document.revision,
        compiledPartSummaries(document, request.ids, report),
        DETAIL_LIMIT
      );
    case 'entity':
      if (request.ids.length > ID_LIMIT) {
        return invalidRequest(
          document.revision,
          'ids',
          `at most ${ID_LIMIT} entity IDs`
        );
      }
      {
        const missing = missingRecordId(
          document.scene.nodes,
          request.ids
        );
        if (missing) {
          return {
            ok: false,
            revision: document.revision,
            error: {
              code: 'not_found',
              path: `ids[${missing.index}]`,
              expected: 'existing scene entity ID'
            }
          };
        }
      }
      return boundedSuccess(
        document.revision,
        selectedValues(document.scene.nodes, request.ids),
        DETAIL_LIMIT
      );
    case 'texture':
      if (request.ids.length > ID_LIMIT) {
        return invalidRequest(
          document.revision,
          'ids',
          `at most ${ID_LIMIT} texture IDs`
        );
      }
      {
        const missing = missingRecordId(
          document.textures,
          request.ids
        );
        if (missing) {
          return {
            ok: false,
            revision: document.revision,
            error: {
              code: 'not_found',
              path: `ids[${missing.index}]`,
              expected: 'existing texture ID'
            }
          };
        }
      }
      return boundedSuccess(
        document.revision,
        selectedValues(document.textures, request.ids),
        DETAIL_LIMIT
      );
    case 'clip': {
      const clip = document.animations[request.id];
      if (!clip) {
        return {
          ok: false,
          revision: document.revision,
          error: {
            code: 'not_found',
            path: 'id',
            expected: 'existing animation clip ID'
          }
        };
      }
      if (
        request.trackId !== undefined &&
        !clip.channels[request.trackId]
      ) {
        return {
          ok: false,
          revision: document.revision,
          error: {
            code: 'not_found',
            path: 'trackId',
            expected: 'existing transform track ID in this clip'
          }
        };
      }
      const authoring = inspectClipAuthoring(
        document,
        clip,
        request.trackId,
        request.cursor,
        request.limit
      );
      if (authoring === null) {
        return invalidRequest(
          document.revision,
          'cursor',
          'clip page cursor from the previous response'
        );
      }
      return boundedSuccess(
        document.revision,
        authoring,
        DETAIL_LIMIT
      );
    }
    case 'activity': {
      const data = inspectActivity(
        document,
        activity,
        request.cursor,
        request.limit
      );
      if (data === null) {
        return invalidRequest(
          document.revision,
          'cursor',
          'activity page cursor from the previous response'
        );
      }
      return boundedSuccess(document.revision, data, DETAIL_LIMIT);
    }
    case 'target': {
      const readiness = evaluateProductionReadiness(document, report);
      const workflow = deriveInspectWorkflow(
        document,
        report,
        readiness,
        visualReviews
      );
      const materialization = evaluateAssetMaterialization(
        document,
        assets
      );
      const exportTarget = projectExportTargetFor(document);
      const compatibility = exportCompatibilitySummary(document);
      return boundedSuccess(
        document.revision,
        {
          target: exportTarget.target,
          gameVersion: compatibility.gameVersion,
          animationSupport: compatibility.animationSupport,
          supportedGameVersions:
            compatibility.supportedGameVersions,
          profileId: document.formatProfile.id,
          formatProfile: document.formatProfile,
          settings: document.settings,
          structurallyValid: readiness.structurallyValid,
          mechanicallyReady: readiness.mechanicallyReady,
          semanticReviewRequired:
            readiness.semanticReviewRequired,
          artifactMaterialized: materialization.materialized,
          assetMaterialization: {
            ...materialization,
            issues: materialization.issues.slice(
              0,
              MATERIALIZATION_ISSUE_LIMIT
            ),
            issueCount: materialization.issues.length,
            issuesTruncated:
              materialization.issues.length >
              MATERIALIZATION_ISSUE_LIMIT
          },
          intent: document.intent ?? null,
          counts: {
            errors: readiness.counts.structuralErrors,
            warnings: readiness.counts.structuralWarnings,
            readinessErrors: readiness.findings.length,
            textures: Object.keys(document.textures).length,
            visibleGeometry: readiness.counts.visibleGeometry,
            enabledVisibleFaces:
              readiness.counts.enabledVisibleFaces,
            texturedVisibleFaces:
              readiness.counts.texturedVisibleFaces,
            untexturedVisibleFaces:
              readiness.counts.untexturedVisibleFaces,
            idleClips: readiness.counts.idleClips,
            idleChannels: readiness.counts.idleChannels,
            features: readiness.counts.features
          },
          readinessFindings: readiness.findings.slice(0, 10),
          readinessFindingsTruncated:
            readiness.findings.length > 10,
          firstReadinessFinding: readiness.firstBlockingFinding,
          workflow
        },
        DETAIL_LIMIT
      );
    }
    case 'finding': {
      const readiness = evaluateProductionReadiness(document, report);
      const finding = [
        ...report.findings,
        ...readiness.findings
      ].find((candidate) => candidate.path === request.path);
      if (!finding) {
        return {
          ok: false,
          revision: document.revision,
          error: {
            code: 'not_found',
            path: request.path,
            expected: 'validation finding path'
          }
        };
      }
      const exact = boundedSuccess(
        document.revision,
        finding,
        DETAIL_LIMIT
      );
      if (exact.ok) return exact;
      return {
        ok: true,
        revision: document.revision,
        truncated: true,
        data: {
          code: finding.code,
          severity: finding.severity,
          message: finding.message.slice(0, 1_000),
          path: finding.path,
          entityCount: finding.entityIds?.length ?? 0,
          assetCount: finding.assetIds?.length ?? 0,
          clipCount: finding.clipIds?.length ?? 0,
          fix: finding.fix?.slice(0, 1_000)
        }
      };
    }
  }
};
