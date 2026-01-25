import type { Capabilities, ToolError } from '../types';
import { ProjectSession, SessionState } from '../session';
import { EditorPort } from '../ports/editor';
import { ok, fail, UsecaseResult } from './result';
import { buildRigTemplate } from '../templates';
import { RigTemplateKind } from '../spec';
import { RIG_TEMPLATE_KINDS } from '../shared/toolConstants';
import { mergeRigParts, RigMergeStrategy } from '../domain/rig';
import { isZeroSize } from '../domain/geometry';
import {
  collectDescendantBones,
  isDescendantBone,
  resolveBoneNameById,
  resolveBoneTarget,
  resolveCubeTarget
} from '../services/lookup';
import { createId } from '../services/id';
import { ensureIdNameMatch, ensureNonBlankString } from '../services/validation';
import { ensureActiveAndRevision } from './guards';

export interface ModelServiceDeps {
  session: ProjectSession;
  editor: EditorPort;
  capabilities: Capabilities;
  getSnapshot: () => SessionState;
  ensureActive: () => ToolError | null;
  ensureRevisionMatch: (ifRevision?: string) => ToolError | null;
  getRigMergeStrategy: () => RigMergeStrategy | undefined;
}

export class ModelService {
  private readonly session: ProjectSession;
  private readonly editor: EditorPort;
  private readonly capabilities: Capabilities;
  private readonly getSnapshot: () => SessionState;
  private readonly ensureActive: () => ToolError | null;
  private readonly ensureRevisionMatch: (ifRevision?: string) => ToolError | null;
  private readonly getRigMergeStrategy: () => RigMergeStrategy | undefined;

  constructor(deps: ModelServiceDeps) {
    this.session = deps.session;
    this.editor = deps.editor;
    this.capabilities = deps.capabilities;
    this.getSnapshot = deps.getSnapshot;
    this.ensureActive = deps.ensureActive;
    this.ensureRevisionMatch = deps.ensureRevisionMatch;
    this.getRigMergeStrategy = deps.getRigMergeStrategy;
  }

  addBone(payload: {
    id?: string;
    name: string;
    parent?: string;
    parentId?: string;
    pivot: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    ifRevision?: string;
  }): UsecaseResult<{ id: string; name: string }> {
    return this.addBoneInternal(payload);
  }

  private addBoneInternal(
    payload: {
      id?: string;
      name: string;
      parent?: string;
      parentId?: string;
      pivot: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      ifRevision?: string;
    },
    options?: { skipRevisionCheck?: boolean }
  ): UsecaseResult<{ id: string; name: string }> {
    const guardErr = ensureActiveAndRevision(
      this.ensureActive,
      this.ensureRevisionMatch,
      payload.ifRevision,
      options
    );
    if (guardErr) return fail(guardErr);
    const snapshot = this.getSnapshot();
    if (!payload.name) {
      return fail({
        code: 'invalid_payload',
        message: 'Bone name is required',
        fix: 'Provide a non-empty bone name.'
      });
    }
    const nameBlankErr = ensureNonBlankString(payload.name, 'Bone name');
    if (nameBlankErr) return fail(nameBlankErr);
    const parentBlankErr = ensureNonBlankString(payload.parent, 'Parent bone name');
    if (parentBlankErr) return fail(parentBlankErr);
    const parentIdBlankErr = ensureNonBlankString(payload.parentId, 'Parent bone id');
    if (parentIdBlankErr) return fail(parentIdBlankErr);
    const parentName = payload.parentId
      ? resolveBoneNameById(snapshot.bones, payload.parentId)
      : payload.parent;
    const parent = parentName ?? undefined;
    if (payload.parentId && !parentName) {
      return fail({ code: 'invalid_payload', message: `Parent bone not found: ${payload.parentId}` });
    }
    const existing = snapshot.bones.find((b) => b.name === payload.name);
    if (existing) {
      return fail({ code: 'invalid_payload', message: `Bone already exists: ${payload.name}` });
    }
    const id = payload.id ?? createId('bone');
    const idConflict = snapshot.bones.some((b) => b.id && b.id === id);
    if (idConflict) {
      return fail({ code: 'invalid_payload', message: `Bone id already exists: ${id}` });
    }
    const err = this.editor.addBone({
      id,
      name: payload.name,
      parent,
      pivot: payload.pivot,
      rotation: payload.rotation,
      scale: payload.scale
    });
    if (err) return fail(err);
    this.session.addBone({
      id,
      name: payload.name,
      parent,
      pivot: payload.pivot,
      rotation: payload.rotation,
      scale: payload.scale
    });
    return ok({ id, name: payload.name });
  }

  updateBone(payload: {
    id?: string;
    name?: string;
    newName?: string;
    parent?: string;
    parentId?: string;
    parentRoot?: boolean;
    pivot?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    ifRevision?: string;
  }): UsecaseResult<{ id: string; name: string }> {
    const guardErr = ensureActiveAndRevision(this.ensureActive, this.ensureRevisionMatch, payload.ifRevision);
    if (guardErr) return fail(guardErr);
    const snapshot = this.getSnapshot();
    const idBlankErr = ensureNonBlankString(payload.id, 'Bone id');
    if (idBlankErr) return fail(idBlankErr);
    const nameBlankErr = ensureNonBlankString(payload.name, 'Bone name');
    if (nameBlankErr) return fail(nameBlankErr);
    const newNameBlankErr = ensureNonBlankString(payload.newName, 'Bone newName');
    if (newNameBlankErr) return fail(newNameBlankErr);
    const parentBlankErr = ensureNonBlankString(payload.parent, 'Parent bone name');
    if (parentBlankErr) return fail(parentBlankErr);
    const parentIdBlankErr = ensureNonBlankString(payload.parentId, 'Parent bone id');
    if (parentIdBlankErr) return fail(parentIdBlankErr);
    if (!payload.id && !payload.name) {
      return fail({ code: 'invalid_payload', message: 'Bone id or name is required' });
    }
    const mismatchErr = ensureIdNameMatch(snapshot.bones, payload.id, payload.name, {
      kind: 'Bone',
      plural: 'bones'
    });
    if (mismatchErr) return fail(mismatchErr);
    const target = resolveBoneTarget(snapshot.bones, payload.id, payload.name);
    if (!target) {
      const label = payload.id ?? payload.name ?? 'unknown';
      return fail({ code: 'invalid_payload', message: `Bone not found: ${label}` });
    }
    const targetName = target.name;
    const targetId = target.id ?? payload.id ?? createId('bone');
    if (payload.newName && payload.newName !== targetName) {
      const conflict = snapshot.bones.some((b) => b.name === payload.newName && b.name !== targetName);
      if (conflict) {
        return fail({ code: 'invalid_payload', message: `Bone already exists: ${payload.newName}` });
      }
    }
    const parentUpdate =
      payload.parentRoot
        ? null
        : payload.parentId
          ? resolveBoneNameById(snapshot.bones, payload.parentId)
          : payload.parent !== undefined
            ? payload.parent
            : undefined;
    if (payload.parentId && !parentUpdate) {
      return fail({ code: 'invalid_payload', message: `Parent bone not found: ${payload.parentId}` });
    }
    if (typeof parentUpdate === 'string') {
      if (parentUpdate === targetName) {
        return fail({ code: 'invalid_payload', message: 'Bone cannot be parented to itself' });
      }
      const parentExists = snapshot.bones.some((b) => b.name === parentUpdate);
      if (!parentExists) {
        return fail({ code: 'invalid_payload', message: `Parent bone not found: ${parentUpdate}` });
      }
      if (isDescendantBone(snapshot.bones, targetName, parentUpdate)) {
        return fail({ code: 'invalid_payload', message: 'Bone cannot be parented to its descendant' });
      }
    }
    const parentForEditor = typeof parentUpdate === 'string' ? parentUpdate : undefined;
    const err = this.editor.updateBone({
      id: targetId,
      name: targetName,
      newName: payload.newName,
      parent: payload.parentRoot ? undefined : parentForEditor,
      parentRoot: payload.parentRoot,
      pivot: payload.pivot,
      rotation: payload.rotation,
      scale: payload.scale
    });
    if (err) return fail(err);
    this.session.updateBone(targetName, {
      id: targetId,
      newName: payload.newName,
      parent: parentUpdate,
      pivot: payload.pivot,
      rotation: payload.rotation,
      scale: payload.scale
    });
    return ok({ id: targetId, name: payload.newName ?? targetName });
  }

  deleteBone(payload: {
    id?: string;
    name?: string;
    ifRevision?: string;
  }): UsecaseResult<{ id: string; name: string; removedBones: number; removedCubes: number }> {
    const guardErr = ensureActiveAndRevision(this.ensureActive, this.ensureRevisionMatch, payload.ifRevision);
    if (guardErr) return fail(guardErr);
    const snapshot = this.getSnapshot();
    const idBlankErr = ensureNonBlankString(payload.id, 'Bone id');
    if (idBlankErr) return fail(idBlankErr);
    const nameBlankErr = ensureNonBlankString(payload.name, 'Bone name');
    if (nameBlankErr) return fail(nameBlankErr);
    if (!payload.id && !payload.name) {
      return fail({ code: 'invalid_payload', message: 'Bone id or name is required' });
    }
    const mismatchErr = ensureIdNameMatch(snapshot.bones, payload.id, payload.name, {
      kind: 'Bone',
      plural: 'bones'
    });
    if (mismatchErr) return fail(mismatchErr);
    const target = resolveBoneTarget(snapshot.bones, payload.id, payload.name);
    if (!target) {
      const label = payload.id ?? payload.name ?? 'unknown';
      return fail({ code: 'invalid_payload', message: `Bone not found: ${label}` });
    }
    const descendants = collectDescendantBones(snapshot.bones, target.name);
    const boneSet = new Set<string>([target.name, ...descendants]);
    const err = this.editor.deleteBone({ id: target.id ?? payload.id, name: target.name });
    if (err) return fail(err);
    const removed = this.session.removeBones(boneSet);
    return ok({
      id: target.id ?? payload.id ?? target.name,
      name: target.name,
      removedBones: removed.removedBones,
      removedCubes: removed.removedCubes
    });
  }

  addCube(payload: {
    id?: string;
    name: string;
    from: [number, number, number];
    to: [number, number, number];
    bone?: string;
    boneId?: string;
    inflate?: number;
    mirror?: boolean;
    ifRevision?: string;
  }): UsecaseResult<{ id: string; name: string }> {
    return this.addCubeInternal(payload);
  }

  private addCubeInternal(
    payload: {
      id?: string;
      name: string;
      from: [number, number, number];
      to: [number, number, number];
      bone?: string;
      boneId?: string;
      inflate?: number;
      mirror?: boolean;
      ifRevision?: string;
    },
    options?: { skipRevisionCheck?: boolean }
  ): UsecaseResult<{ id: string; name: string }> {
    const guardErr = ensureActiveAndRevision(
      this.ensureActive,
      this.ensureRevisionMatch,
      payload.ifRevision,
      options
    );
    if (guardErr) return fail(guardErr);
    const snapshot = this.getSnapshot();
    if (!payload.name) {
      return fail({
        code: 'invalid_payload',
        message: 'Cube name is required',
        fix: 'Provide a non-empty cube name.'
      });
    }
    const nameBlankErr = ensureNonBlankString(payload.name, 'Cube name');
    if (nameBlankErr) return fail(nameBlankErr);
    const boneBlankErr = ensureNonBlankString(payload.bone, 'Cube bone');
    if (boneBlankErr) return fail(boneBlankErr);
    const boneIdBlankErr = ensureNonBlankString(payload.boneId, 'Cube boneId');
    if (boneIdBlankErr) return fail(boneIdBlankErr);
    if (!payload.bone && !payload.boneId) {
      return fail({
        code: 'invalid_payload',
        message: 'Cube bone is required',
        fix: 'Provide bone or boneId to attach the cube.'
      });
    }
    const resolvedBone =
      payload.boneId ? resolveBoneNameById(snapshot.bones, payload.boneId) : payload.bone;
    if (!resolvedBone) {
      const label = payload.boneId ?? payload.bone;
      return fail({ code: 'invalid_payload', message: `Bone not found: ${label}` });
    }
    const boneExists = snapshot.bones.some((b) => b.name === resolvedBone);
    if (!boneExists) {
      return fail({ code: 'invalid_payload', message: `Bone not found: ${resolvedBone}` });
    }
    const existing = snapshot.cubes.find((c) => c.name === payload.name);
    if (existing) {
      return fail({ code: 'invalid_payload', message: `Cube already exists: ${payload.name}` });
    }
    const limitErr = this.ensureCubeLimit(1);
    if (limitErr) return fail(limitErr);
    const id = payload.id ?? createId('cube');
    const idConflict = snapshot.cubes.some((c) => c.id && c.id === id);
    if (idConflict) {
      return fail({ code: 'invalid_payload', message: `Cube id already exists: ${id}` });
    }
    const err = this.editor.addCube({
      id,
      name: payload.name,
      from: payload.from,
      to: payload.to,
      bone: resolvedBone,
      inflate: payload.inflate,
      mirror: payload.mirror
    });
    if (err) return fail(err);
    this.session.addCube({
      id,
      name: payload.name,
      from: payload.from,
      to: payload.to,
      bone: resolvedBone,
      inflate: payload.inflate,
      mirror: payload.mirror
    });
    return ok({ id, name: payload.name });
  }

  updateCube(payload: {
    id?: string;
    name?: string;
    newName?: string;
    bone?: string;
    boneId?: string;
    boneRoot?: boolean;
    from?: [number, number, number];
    to?: [number, number, number];
    inflate?: number;
    mirror?: boolean;
    ifRevision?: string;
  }): UsecaseResult<{ id: string; name: string }> {
    const guardErr = ensureActiveAndRevision(this.ensureActive, this.ensureRevisionMatch, payload.ifRevision);
    if (guardErr) return fail(guardErr);
    const snapshot = this.getSnapshot();
    const idBlankErr = ensureNonBlankString(payload.id, 'Cube id');
    if (idBlankErr) return fail(idBlankErr);
    const nameBlankErr = ensureNonBlankString(payload.name, 'Cube name');
    if (nameBlankErr) return fail(nameBlankErr);
    const newNameBlankErr = ensureNonBlankString(payload.newName, 'Cube newName');
    if (newNameBlankErr) return fail(newNameBlankErr);
    const boneBlankErr = ensureNonBlankString(payload.bone, 'Cube bone');
    if (boneBlankErr) return fail(boneBlankErr);
    const boneIdBlankErr = ensureNonBlankString(payload.boneId, 'Cube boneId');
    if (boneIdBlankErr) return fail(boneIdBlankErr);
    if (!payload.id && !payload.name) {
      return fail({ code: 'invalid_payload', message: 'Cube id or name is required' });
    }
    const mismatchErr = ensureIdNameMatch(snapshot.cubes, payload.id, payload.name, {
      kind: 'Cube',
      plural: 'cubes'
    });
    if (mismatchErr) return fail(mismatchErr);
    const target = resolveCubeTarget(snapshot.cubes, payload.id, payload.name);
    if (!target) {
      const label = payload.id ?? payload.name ?? 'unknown';
      return fail({ code: 'invalid_payload', message: `Cube not found: ${label}` });
    }
    const targetName = target.name;
    const targetId = target.id ?? payload.id ?? createId('cube');
    if (payload.newName && payload.newName !== targetName) {
      const conflict = snapshot.cubes.some((c) => c.name === payload.newName && c.name !== targetName);
      if (conflict) {
        return fail({ code: 'invalid_payload', message: `Cube already exists: ${payload.newName}` });
      }
    }
    const boneUpdate = payload.boneRoot
      ? 'root'
      : payload.boneId
        ? resolveBoneNameById(snapshot.bones, payload.boneId)
        : payload.bone !== undefined
          ? payload.bone
          : undefined;
    if (payload.boneId && !boneUpdate) {
      return fail({ code: 'invalid_payload', message: `Bone not found: ${payload.boneId}` });
    }
    if (typeof boneUpdate === 'string' && boneUpdate !== 'root') {
      const boneExists = snapshot.bones.some((b) => b.name === boneUpdate);
      if (!boneExists) {
        return fail({ code: 'invalid_payload', message: `Bone not found: ${boneUpdate}` });
      }
    }
    const err = this.editor.updateCube({
      id: targetId,
      name: targetName,
      newName: payload.newName,
      bone: payload.boneRoot ? undefined : typeof boneUpdate === 'string' ? boneUpdate : undefined,
      boneRoot: payload.boneRoot,
      from: payload.from,
      to: payload.to,
      inflate: payload.inflate,
      mirror: payload.mirror
    });
    if (err) return fail(err);
    if (boneUpdate === 'root' && !snapshot.bones.some((b) => b.name === 'root')) {
      this.session.addBone({ id: createId('bone'), name: 'root', pivot: [0, 0, 0] });
    }
    this.session.updateCube(targetName, {
      id: targetId,
      newName: payload.newName,
      bone: typeof boneUpdate === 'string' ? boneUpdate : undefined,
      from: payload.from,
      to: payload.to,
      inflate: payload.inflate,
      mirror: payload.mirror
    });
    return ok({ id: targetId, name: payload.newName ?? targetName });
  }

  deleteCube(payload: { id?: string; name?: string; ifRevision?: string }): UsecaseResult<{ id: string; name: string }> {
    const guardErr = ensureActiveAndRevision(this.ensureActive, this.ensureRevisionMatch, payload.ifRevision);
    if (guardErr) return fail(guardErr);
    const snapshot = this.getSnapshot();
    const idBlankErr = ensureNonBlankString(payload.id, 'Cube id');
    if (idBlankErr) return fail(idBlankErr);
    const nameBlankErr = ensureNonBlankString(payload.name, 'Cube name');
    if (nameBlankErr) return fail(nameBlankErr);
    if (!payload.id && !payload.name) {
      return fail({ code: 'invalid_payload', message: 'Cube id or name is required' });
    }
    const mismatchErr = ensureIdNameMatch(snapshot.cubes, payload.id, payload.name, {
      kind: 'Cube',
      plural: 'cubes'
    });
    if (mismatchErr) return fail(mismatchErr);
    const target = resolveCubeTarget(snapshot.cubes, payload.id, payload.name);
    if (!target) {
      const label = payload.id ?? payload.name ?? 'unknown';
      return fail({ code: 'invalid_payload', message: `Cube not found: ${label}` });
    }
    const err = this.editor.deleteCube({ id: target.id ?? payload.id, name: target.name });
    if (err) return fail(err);
    this.session.removeCubes([target.name]);
    return ok({ id: target.id ?? payload.id ?? target.name, name: target.name });
  }

  applyRigTemplate(payload: { templateId: string; ifRevision?: string }): UsecaseResult<{ templateId: string }> {
    const guardErr = ensureActiveAndRevision(this.ensureActive, this.ensureRevisionMatch, payload.ifRevision);
    if (guardErr) return fail(guardErr);
    const templateId = payload.templateId;
    if (!RIG_TEMPLATE_KINDS.includes(templateId as (typeof RIG_TEMPLATE_KINDS)[number])) {
      return fail({ code: 'invalid_payload', message: `Unknown template: ${templateId}` });
    }
    const templateParts = buildRigTemplate(templateId as RigTemplateKind, []);
    const cubeParts = templateParts.filter((part) => !isZeroSize(part.size));
    const limitErr = this.ensureCubeLimit(cubeParts.length);
    if (limitErr) return fail(limitErr);
    const snapshot = this.getSnapshot();
    const existing = new Set(snapshot.bones.map((b) => b.name));
    let partsToAdd = templateParts;
    try {
      const merged = mergeRigParts(templateParts, existing, this.getRigMergeStrategy() ?? 'skip_existing');
      partsToAdd = merged.parts;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'rig template merge failed';
      return fail({ code: 'invalid_payload', message });
    }

    for (const part of partsToAdd) {
      const boneRes = this.addBoneInternal(
        {
        name: part.id,
        parent: part.parent,
        pivot: part.pivot ?? [0, 0, 0]
        },
        { skipRevisionCheck: true }
      );
      if (!boneRes.ok) return boneRes;
      if (!isZeroSize(part.size)) {
        const from: [number, number, number] = [...part.offset];
        const to: [number, number, number] = [
          part.offset[0] + part.size[0],
          part.offset[1] + part.size[1],
          part.offset[2] + part.size[2]
        ];
        const cubeRes = this.addCubeInternal(
          {
          name: part.id,
          from,
          to,
          bone: part.id,
          inflate: part.inflate,
          mirror: part.mirror
          },
          { skipRevisionCheck: true }
        );
        if (!cubeRes.ok) return cubeRes;
      }
    }
    return ok({ templateId });
  }

  private ensureCubeLimit(increment: number): ToolError | null {
    const snapshot = this.getSnapshot();
    const current = snapshot.cubes.length;
    const limit = this.capabilities.limits.maxCubes;
    if (current + increment > limit) {
      return { code: 'invalid_payload', message: `Cube limit exceeded (${limit})` };
    }
    return null;
  }
}
