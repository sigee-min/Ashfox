import {
  getCommandDefinition,
  listCommandDefinitions,
  type CommandName,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import { boundedSuccess } from './boundedResult';
import type {
  InspectRequest,
  InspectResult
} from './types';

const DEFAULT_LIMIT = 2048;
const DETAIL_LIMIT = 4096;
const ID_LIMIT = 10;

const selectedCommandNames = (
  document: ProjectDocument,
  selectedNodeId: string | null
): ReadonlySet<CommandName> => {
  const selected = selectedNodeId
    ? document.scene.nodes[selectedNodeId]
    : undefined;
  const names = new Set<CommandName>([
    'project.rename',
    'project.target.set',
    'scene.bones.create',
    'scene.cubes.create',
    'animation.clip.upsert',
    'textures.preview.set',
    'textures.rename',
    'textures.raster.set',
    'textures.uvAtlas.generate'
  ]);
  if (selected) {
    names.add('scene.nodes.transform');
    names.add('scene.nodes.visibility');
    names.add('scene.nodes.delete');
    names.add('scene.nodes.align');
    names.add('scene.nodes.pivot');
    names.add('scene.nodes.reparent');
  }
  if (selected?.kind === 'cube') {
    names.add('scene.cubes.duplicate');
    names.add('scene.cubes.mirror');
    names.add('scene.cubes.repeat');
    names.add('scene.cubes.uv.fit');
    names.add('scene.cubes.material');
  }
  if (Object.keys(document.animations).length > 0) {
    names.add('animation.channels.upsert');
    names.add('animation.channels.phase');
    names.add('animation.channels.mirror');
    names.add('animation.clip.closeLoop');
    names.add('animation.clip.delete');
  }
  return names;
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

const inspectDefault = (
  document: ProjectDocument,
  selectedNodeId: string | null,
  report: ValidationReport
): InspectResult => {
  const available = selectedCommandNames(document, selectedNodeId);
  return boundedSuccess(
    document.revision,
    {
      commandPort: 'connected',
      project: {
        id: document.id,
        name: document.name,
        revision: document.revision,
        target: document.formatProfile.id
      },
      selection: selectedNodeId,
      counts: {
        nodes: Object.keys(document.scene.nodes).length,
        textures: Object.keys(document.textures).length,
        clips: Object.keys(document.animations).length
      },
      commands: listCommandDefinitions()
        .filter((definition) => available.has(definition.name))
        .map((definition) => ({
          name: definition.name,
          label: definition.label
        })),
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
    case 'target':
      return boundedSuccess(
        document.revision,
        {
          formatProfile: document.formatProfile,
          settings: document.settings,
          valid: report.valid
        },
        DETAIL_LIMIT
      );
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
