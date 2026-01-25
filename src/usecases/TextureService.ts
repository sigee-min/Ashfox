import {
  AutoUvAtlasPayload,
  AutoUvAtlasResult,
  Capabilities,
  GenerateTexturePresetPayload,
  GenerateTexturePresetResult,
  PreflightTextureResult,
  ReadTexturePayload,
  ReadTextureResult,
  ToolError
} from '../types';
import { ProjectSession, SessionState } from '../session';
import { CubeFaceDirection, EditorPort, FaceUvMap, TextureSource } from '../ports/editor';
import { TextureMeta } from '../types/texture';
import { computeTextureUsageId } from '../domain/textureUsage';
import { findUvOverlapIssues, formatUvFaceRect } from '../domain/uvOverlap';
import { checkDimensions } from '../domain/dimensions';
import { runAutoUvAtlas, runGenerateTexturePreset, TextureToolContext } from './textureTools';
import { ok, fail, UsecaseResult } from './result';
import { TextureCrudService } from './TextureCrudService';
import { resolveCubeTarget, resolveTextureTarget } from '../services/lookup';
import { toDomainTextureUsage } from './domainMappers';
import { validateUvBounds } from '../domain/uvBounds';
import { validateUvAssignments } from '../domain/uvAssignments';
import { ensureActiveAndRevision, ensureActiveOnly } from './guards';
import type { TextureRendererPort } from '../ports/textureRenderer';
import type { TmpStorePort } from '../ports/tmpStore';
import type { UvPolicyConfig } from '../domain/uvPolicy';
import { ensureNonBlankString } from '../services/validation';
import {
  computeUvBounds,
  normalizeCubeFaces,
  recommendResolution,
  resolveCubeTargets,
  summarizeTextureUsage
} from '../services/textureUtils';

export interface TextureServiceDeps {
  session: ProjectSession;
  editor: EditorPort;
  capabilities: Capabilities;
  textureRenderer?: TextureRendererPort;
  tmpStore?: TmpStorePort;
  getSnapshot: () => SessionState;
  ensureActive: () => ToolError | null;
  ensureRevisionMatch: (ifRevision?: string) => ToolError | null;
  getUvPolicyConfig: () => UvPolicyConfig;
}

export class TextureService {
  private readonly session: ProjectSession;
  private readonly editor: EditorPort;
  private readonly capabilities: Capabilities;
  private readonly textureRenderer?: TextureRendererPort;
  private readonly tmpStore?: TmpStorePort;
  private readonly getSnapshot: () => SessionState;
  private readonly ensureActive: () => ToolError | null;
  private readonly ensureRevisionMatch: (ifRevision?: string) => ToolError | null;
  private readonly getUvPolicyConfig: () => UvPolicyConfig;
  private readonly textureCrud: TextureCrudService;

  constructor(deps: TextureServiceDeps) {
    this.session = deps.session;
    this.editor = deps.editor;
    this.capabilities = deps.capabilities;
    this.textureRenderer = deps.textureRenderer;
    this.tmpStore = deps.tmpStore;
    this.getSnapshot = deps.getSnapshot;
    this.ensureActive = deps.ensureActive;
    this.ensureRevisionMatch = deps.ensureRevisionMatch;
    this.getUvPolicyConfig = deps.getUvPolicyConfig;
    this.textureCrud = new TextureCrudService({
      session: this.session,
      editor: this.editor,
      getSnapshot: this.getSnapshot,
      ensureActive: this.ensureActive,
      ensureRevisionMatch: this.ensureRevisionMatch,
      tmpStore: this.tmpStore
    });
  }

  getProjectTextureResolution(): { width: number; height: number } | null {
    return this.editor.getProjectTextureResolution();
  }

  setProjectTextureResolution(payload: {
    width: number;
    height: number;
    ifRevision?: string;
    modifyUv?: boolean;
  }): UsecaseResult<{ width: number; height: number }> {
    const guardErr = ensureActiveAndRevision(this.ensureActive, this.ensureRevisionMatch, payload.ifRevision);
    if (guardErr) return fail(guardErr);
    const width = Number(payload.width);
    const height = Number(payload.height);
    const modifyUv = payload.modifyUv === true;
    const maxSize = this.capabilities.limits.maxTextureSize;
    const sizeCheck = checkDimensions(width, height, { requireInteger: true, maxSize });
    if (!sizeCheck.ok) {
      if (sizeCheck.reason === 'non_positive') {
        return fail({ code: 'invalid_payload', message: 'width and height must be positive numbers.' });
      }
      if (sizeCheck.reason === 'non_integer') {
        return fail({ code: 'invalid_payload', message: 'width and height must be integers.' });
      }
      return fail({
        code: 'invalid_payload',
        message: `Texture resolution exceeds max size (${maxSize}).`,
        fix: `Use width/height <= ${maxSize}.`,
        details: { width, height, maxSize }
      });
    }
    const err = this.editor.setProjectTextureResolution(width, height, modifyUv);
    if (err) return fail(err);
    return ok({ width, height });
  }

  getTextureUsage(payload: { textureId?: string; textureName?: string }): UsecaseResult<{
    textures: Array<{
      id?: string;
      name: string;
      cubeCount: number;
      faceCount: number;
      cubes: Array<{ id?: string; name: string; faces: Array<{ face: CubeFaceDirection; uv?: [number, number, number, number] }> }>;
    }>;
    unresolved?: Array<{ textureRef: string; cubeId?: string; cubeName: string; face: CubeFaceDirection }>;
  }> {
    const activeErr = ensureActiveOnly(this.ensureActive);
    if (activeErr) return fail(activeErr);
    const idBlankErr = ensureNonBlankString(payload.textureId, 'textureId');
    if (idBlankErr) return fail(idBlankErr);
    const nameBlankErr = ensureNonBlankString(payload.textureName, 'textureName');
    if (nameBlankErr) return fail(nameBlankErr);
    const res = this.editor.getTextureUsage(payload);
    if (res.error) return fail(res.error);
    return ok(res.result!);
  }

  preflightTexture(payload: { textureId?: string; textureName?: string; includeUsage?: boolean }): UsecaseResult<PreflightTextureResult> {
    const activeErr = ensureActiveOnly(this.ensureActive);
    if (activeErr) return fail(activeErr);
    const idBlankErr = ensureNonBlankString(payload.textureId, 'textureId');
    if (idBlankErr) return fail(idBlankErr);
    const nameBlankErr = ensureNonBlankString(payload.textureName, 'textureName');
    if (nameBlankErr) return fail(nameBlankErr);
    const usageRes = this.editor.getTextureUsage({ textureId: payload.textureId, textureName: payload.textureName });
    if (usageRes.error) return fail(usageRes.error);
    const usageRaw = usageRes.result ?? { textures: [] };
    const usage = toDomainTextureUsage(usageRaw);
    const usageIdSource =
      payload.textureId || payload.textureName ? this.editor.getTextureUsage({}) : usageRes;
    if (usageIdSource.error) return fail(usageIdSource.error);
    const usageIdRaw = usageIdSource.result ?? { textures: [] };
    const uvUsageId = computeTextureUsageId(toDomainTextureUsage(usageIdRaw));
    const textureResolution = this.editor.getProjectTextureResolution() ?? undefined;
    const usageSummary = summarizeTextureUsage(usageRaw);
    const uvBounds = computeUvBounds(usageRaw);
    const warnings: string[] = [];
    if (!uvBounds) {
      warnings.push('No UV rects found; preflight cannot compute UV bounds.');
    }
    if (usageSummary.unresolvedCount > 0) {
      warnings.push(`Unresolved texture references detected (${usageSummary.unresolvedCount}).`);
    }
    if (textureResolution && uvBounds) {
      if (uvBounds.maxX > textureResolution.width || uvBounds.maxY > textureResolution.height) {
        warnings.push(
          `UV bounds exceed textureResolution (${uvBounds.maxX}x${uvBounds.maxY} > ${textureResolution.width}x${textureResolution.height}).`
        );
      }
    }
    const overlaps = findUvOverlapIssues(usage);
    overlaps.forEach((overlap) => {
      const example = overlap.example
        ? ` Example: ${formatUvFaceRect(overlap.example.a)} overlaps ${formatUvFaceRect(overlap.example.b)}.`
        : '';
      warnings.push(
        `UV overlap detected for texture "${overlap.textureName}" (${overlap.conflictCount} conflict${overlap.conflictCount === 1 ? '' : 's'}).` +
          ` Only identical UV rects may overlap.` +
          example
      );
    });
    const recommendedResolution = recommendResolution(uvBounds, textureResolution, this.capabilities.limits.maxTextureSize);
    const result: PreflightTextureResult = {
      uvUsageId,
      warnings,
      usageSummary,
      uvBounds: uvBounds ?? undefined,
      textureResolution,
      recommendedResolution: recommendedResolution ?? undefined,
      textureUsage: payload.includeUsage ? usageRaw : undefined
    };
    return ok(result);
  }

  generateTexturePreset(payload: GenerateTexturePresetPayload): UsecaseResult<GenerateTexturePresetResult> {
    return runGenerateTexturePreset(this.getTextureToolContext(), payload);
  }

  autoUvAtlas(payload: AutoUvAtlasPayload): UsecaseResult<AutoUvAtlasResult> {
    return runAutoUvAtlas(this.getTextureToolContext(), payload);
  }

  importTexture(payload: {
    id?: string;
    name: string;
    image: CanvasImageSource;
    width?: number;
    height?: number;
    ifRevision?: string;
  } & TextureMeta): UsecaseResult<{ id: string; name: string }> {
    return this.textureCrud.importTexture(payload);
  }

  updateTexture(payload: {
    id?: string;
    name?: string;
    newName?: string;
    image: CanvasImageSource;
    width?: number;
    height?: number;
    ifRevision?: string;
  } & TextureMeta): UsecaseResult<{ id: string; name: string }> {
    return this.textureCrud.updateTexture(payload);
  }

  deleteTexture(payload: { id?: string; name?: string; ifRevision?: string }): UsecaseResult<{ id: string; name: string }> {
    return this.textureCrud.deleteTexture(payload);
  }

  readTexture(payload: { id?: string; name?: string }): UsecaseResult<TextureSource> {
    return this.textureCrud.readTexture(payload);
  }

  readTextureImage(payload: ReadTexturePayload): UsecaseResult<ReadTextureResult> {
    return this.textureCrud.readTextureImage(payload);
  }

  assignTexture(payload: {
    textureId?: string;
    textureName?: string;
    cubeIds?: string[];
    cubeNames?: string[];
    faces?: CubeFaceDirection[];
    ifRevision?: string;
  }): UsecaseResult<{ textureId?: string; textureName: string; cubeCount: number; faces?: CubeFaceDirection[] }> {
    const guardErr = ensureActiveAndRevision(this.ensureActive, this.ensureRevisionMatch, payload.ifRevision);
    if (guardErr) return fail(guardErr);
    if (!payload.textureId && !payload.textureName) {
      return fail({
        code: 'invalid_payload',
        message: 'textureId or textureName is required',
        fix: 'Provide textureId or textureName from list_textures.'
      });
    }
    const snapshot = this.getSnapshot();
    const texture = resolveTextureTarget(snapshot.textures, payload.textureId, payload.textureName);
    if (!texture) {
      const label = payload.textureId ?? payload.textureName ?? 'unknown';
      return fail({ code: 'invalid_payload', message: `Texture not found: ${label}` });
    }
    const cubes = resolveCubeTargets(snapshot.cubes, payload.cubeIds, payload.cubeNames);
    if (cubes.length === 0) {
      return fail({ code: 'invalid_payload', message: 'No target cubes found' });
    }
    const faces = normalizeCubeFaces(payload.faces);
    if (payload.faces && payload.faces.length > 0 && !faces) {
      return fail({
        code: 'invalid_payload',
        message: 'faces must include valid directions (north/south/east/west/up/down)'
      });
    }
    const cubeIds = Array.from(new Set(cubes.map((cube) => cube.id).filter(Boolean) as string[]));
    const cubeNames = Array.from(new Set(cubes.map((cube) => cube.name)));
    const err = this.editor.assignTexture({
      textureId: texture.id ?? payload.textureId,
      textureName: texture.name,
      cubeIds,
      cubeNames,
      faces: faces ?? undefined
    });
    if (err) return fail(err);
    return ok({
      textureId: texture.id ?? payload.textureId,
      textureName: texture.name,
      cubeCount: cubes.length,
      faces: faces ?? undefined
    });
  }

  setFaceUv(payload: {
    cubeId?: string;
    cubeName?: string;
    faces: FaceUvMap;
    ifRevision?: string;
  }): UsecaseResult<{ cubeId?: string; cubeName: string; faces: CubeFaceDirection[] }> {
    const guardErr = ensureActiveAndRevision(this.ensureActive, this.ensureRevisionMatch, payload.ifRevision);
    if (guardErr) return fail(guardErr);
    const assignmentRes = validateUvAssignments([
      { cubeId: payload.cubeId, cubeName: payload.cubeName, faces: payload.faces }
    ]);
    if (!assignmentRes.ok) {
      if (assignmentRes.error.message.includes('cubeId') || assignmentRes.error.message.includes('cubeName')) {
        return fail({
          ...assignmentRes.error,
          fix: 'Provide cubeId or cubeName from get_project_state.'
        });
      }
      if (assignmentRes.error.message.includes('faces must include at least one mapping')) {
        return fail({
          ...assignmentRes.error,
          fix: 'Provide a faces map with at least one face (e.g., {"north":[0,0,4,4]}).'
        });
      }
      return fail(assignmentRes.error);
    }
    const snapshot = this.getSnapshot();
    const target = resolveCubeTarget(snapshot.cubes, payload.cubeId, payload.cubeName);
    if (!target) {
      const label = payload.cubeId ?? payload.cubeName ?? 'unknown';
      return fail({ code: 'invalid_payload', message: `Cube not found: ${label}` });
    }
    const faces: CubeFaceDirection[] = [];
    const normalized: FaceUvMap = {};
    const faceEntries = Object.entries(payload.faces ?? {});
    for (const [faceKey, uv] of faceEntries) {
      const [x1, y1, x2, y2] = uv as [number, number, number, number];
      const boundsErr = this.ensureFaceUvWithinResolution([x1, y1, x2, y2]);
      if (boundsErr) return fail(boundsErr);
      normalized[faceKey as CubeFaceDirection] = [x1, y1, x2, y2];
      faces.push(faceKey as CubeFaceDirection);
    }
    const err = this.editor.setFaceUv({
      cubeId: target.id ?? payload.cubeId,
      cubeName: target.name,
      faces: normalized
    });
    if (err) return fail(err);
    return ok({ cubeId: target.id ?? payload.cubeId, cubeName: target.name, faces });
  }

  private ensureFaceUvWithinResolution(uv: [number, number, number, number]): ToolError | null {
    const resolution = this.editor.getProjectTextureResolution();
    if (!resolution) return null;
    const boundsErr = validateUvBounds(uv, resolution, { uv, textureResolution: resolution });
    if (!boundsErr) return null;
    if (boundsErr.ok) return null;
    const reason = boundsErr.error.details?.reason;
    if (reason === 'out_of_bounds') {
      return {
        ...boundsErr.error,
        fix: 'Use get_project_state to read textureResolution and adjust UVs or change the project texture resolution.'
      };
    }
    return boundsErr.error;
  }

  private getTextureToolContext(): TextureToolContext {
    return {
      ensureActive: () => this.ensureActive(),
      ensureRevisionMatch: (ifRevision?: string) => this.ensureRevisionMatch(ifRevision),
      getSnapshot: () => this.getSnapshot(),
      editor: this.editor,
      textureRenderer: this.textureRenderer,
      capabilities: this.capabilities,
      getUvPolicyConfig: () => this.getUvPolicyConfig(),
      importTexture: (payload) => this.importTexture(payload),
      updateTexture: (payload) => this.updateTexture(payload)
    };
  }
}
