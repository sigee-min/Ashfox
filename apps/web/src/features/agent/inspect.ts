import {
  CUBE_FACE_DIRECTIONS,
  getCommandDefinition,
  listCommandDefinitions,
  type ProjectDocument,
  type SceneNode,
  type ValidationReport
} from '@ashfox/engine-core';

import { boundedSuccess } from './boundedResult';
import { agentCommandProtocol } from './agentCommandProtocol';
import type {
  InspectRequest,
  InspectResult
} from './types';

const DEFAULT_LIMIT = 2048;
const DETAIL_LIMIT = 4096;
const ID_LIMIT = 10;

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

const isEffectivelyVisible = (
  document: ProjectDocument,
  nodeId: string
): boolean => {
  const visited = new Set<string>();
  let currentId: string | null = nodeId;
  while (currentId !== null) {
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const node: SceneNode | undefined =
      document.scene.nodes[currentId];
    if (!node || !node.visible) return false;
    currentId = node.parentId;
  }
  return true;
};

const isIdleClipName = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'idle' ||
    /^animation\.[a-z0-9_.-]+\.idle$/.test(normalized)
  );
};

const inspectDefault = (
  document: ProjectDocument,
  selectedNodeId: string | null,
  report: ValidationReport
): InspectResult => {
  const commands = listCommandDefinitions()
    .map((definition) => definition.name);
  const nodes = Object.values(document.scene.nodes);
  const clips = Object.values(document.animations);
  const visibleNodes = nodes.filter((node) =>
    isEffectivelyVisible(document, node.id)
  );
  const visibleFaceTextureIds = visibleNodes.flatMap((node) => {
    if (node.kind === 'cube') {
      return CUBE_FACE_DIRECTIONS
        .map((direction) => node.faces[direction])
        .filter((face) => face.enabled)
        .map((face) => face.textureId);
    }
    return node.kind === 'mesh'
      ? Object.values(node.faces).map((face) => face.textureId)
      : [];
  });
  const texturedVisibleFaces = visibleFaceTextureIds.filter(
    (textureId) =>
      textureId !== null &&
      document.textures[textureId] !== undefined
  ).length;
  const idleClips = clips.filter((clip) =>
    isIdleClipName(clip.name)
  );
  return boundedSuccess(
    document.revision,
    {
      commandPort: 'connected',
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
        name: document.name,
        revision: document.revision,
        target: document.formatProfile.id
      },
      selection: selectedNodeId,
      counts: {
        nodes: nodes.length,
        bones: nodes.filter((node) => node.kind === 'bone').length,
        cubes: nodes.filter((node) => node.kind === 'cube').length,
        visibleCubes: nodes.filter(
          (node) =>
            node.kind === 'cube' &&
            isEffectivelyVisible(document, node.id)
        ).length,
        meshes: nodes.filter((node) => node.kind === 'mesh').length,
        locators: nodes.filter((node) => node.kind === 'locator').length,
        enabledVisibleFaces: visibleFaceTextureIds.length,
        texturedVisibleFaces,
        untexturedVisibleFaces:
          visibleFaceTextureIds.length - texturedVisibleFaces,
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
        idleClips: idleClips.length,
        idleChannels: idleClips.reduce(
          (count, clip) => count + Object.keys(clip.channels).length,
          0
        )
      },
      commands,
      blockingFinding: report.findings.find(
        (finding) => finding.severity === 'error'
      )?.path
    },
    DEFAULT_LIMIT
  );
};

export const inspectProject = (
  document: ProjectDocument,
  selectedNodeId: string | null,
  report: ValidationReport,
  request?: InspectRequest
): InspectResult => {
  if (!request) return inspectDefault(document, selectedNodeId, report);

  switch (request.kind) {
    case 'command': {
      const definition = getCommandDefinition(request.name);
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
          inputSchema: definition.inputSchema
        },
        DETAIL_LIMIT
      );
    }
    case 'entity':
      if (request.ids.length > ID_LIMIT) {
        return invalidRequest(
          document.revision,
          'ids',
          `at most ${ID_LIMIT} entity IDs`
        );
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
      return boundedSuccess(
        document.revision,
        selectedValues(document.textures, request.ids),
        DETAIL_LIMIT
      );
    case 'clip':
      if (request.ids.length > ID_LIMIT) {
        return invalidRequest(
          document.revision,
          'ids',
          `at most ${ID_LIMIT} clip IDs`
        );
      }
      return boundedSuccess(
        document.revision,
        selectedValues(document.animations, request.ids),
        DETAIL_LIMIT
      );
    case 'target': {
      const errors = report.findings.filter(
        (finding) => finding.severity === 'error'
      );
      const warnings = report.findings.filter(
        (finding) => finding.severity === 'warning'
      );
      return boundedSuccess(
        document.revision,
        {
          formatProfile: document.formatProfile,
          settings: document.settings,
          valid: report.valid,
          productionReady:
            errors.length === 0 && warnings.length === 0,
          counts: {
            errors: errors.length,
            warnings: warnings.length,
            textures: Object.keys(document.textures).length
          },
          firstReadinessFinding: errors[0] ?? warnings[0] ?? null
        },
        DETAIL_LIMIT
      );
    }
    case 'finding': {
      const finding = report.findings.find(
        (candidate) => candidate.path === request.path
      );
      return finding
        ? boundedSuccess(document.revision, finding, DETAIL_LIMIT)
        : {
            ok: false,
            revision: document.revision,
            error: {
              code: 'not_found',
              path: request.path,
              expected: 'validation finding path'
            }
          };
    }
  }
};
