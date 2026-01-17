import { SnapshotPort } from '../../ports/snapshot';
import { SessionState, TrackedAnimationChannel } from '../../session';
import { FormatKind } from '../../types';
import { matchesFormatKind } from '../../domain/format';
import { Logger } from '../../logging';

/* Blockbench globals (provided at runtime). */
declare const Outliner: any;
declare const Group: any;
declare const Cube: any;
declare const Texture: any;
declare const Animation: any;
declare const ModelFormat: any;

type Vec3Like = { x: number; y: number; z: number } | [number, number, number];

type SnapshotGlobals = {
  Outliner?: any;
  Group?: any;
  Cube?: any;
  Texture?: any;
  Animation?: any;
  ModelFormat?: any;
};

const readGlobals = (): SnapshotGlobals => ({
  Outliner: (globalThis as any).Outliner,
  Group: (globalThis as any).Group,
  Cube: (globalThis as any).Cube,
  Texture: (globalThis as any).Texture,
  Animation: (globalThis as any).Animation,
  ModelFormat: (globalThis as any).ModelFormat
});

export class BlockbenchSnapshot implements SnapshotPort {
  private readonly log?: Logger;

  constructor(log?: Logger) {
    this.log = log;
  }

  readSnapshot(): SessionState | null {
    try {
      const bones: SessionState['bones'] = [];
      const cubes: SessionState['cubes'] = [];
      const textures: SessionState['textures'] = [];
      const animations: SessionState['animations'] = [];
      const globals = readGlobals();
      const formatId = getActiveFormatId(globals);
      const format = guessFormatKind(formatId);
      const name = getProjectName();
      const id = getProjectId();
      const dirty = getProjectDirty();

      const root = globals.Outliner?.root ?? [];
      walkNodes(root, undefined, bones, cubes);
      ensureRootBone(bones, cubes);

      const texList = globals.Texture?.all ?? [];
      if (Array.isArray(texList)) {
        texList.forEach((tex: any) => {
          textures.push({
            id: readTextureId(tex),
            name: tex?.name ?? tex?.id ?? 'texture',
            path: tex?.path ?? tex?.source,
            width: tex?.width ?? tex?.img?.naturalWidth ?? 0,
            height: tex?.height ?? tex?.img?.naturalHeight ?? 0
          });
        });
      }

      const animState = getAnimationState(globals);
      animState.animations.forEach((anim) => {
        const channels = extractChannels(anim);
        animations.push({
          id: readAnimationId(anim),
          name: anim?.name ?? 'animation',
          length: Number(anim?.length ?? anim?.animation_length ?? anim?.duration ?? 0),
          loop: normalizeLoop(anim?.loop),
          fps: Number(anim?.snapping ?? anim?.fps ?? 0) || undefined,
          channels
        });
      });

      return {
        id,
        format,
        formatId,
        name,
        dirty,
        bones,
        cubes,
        textures,
        animations,
        animationsStatus: animState.status
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'snapshot read failed';
      this.log?.error('snapshot read failed', { message });
      return null;
    }
  }
}

function walkNodes(nodes: any[], parent: string | undefined, bones: SessionState['bones'], cubes: SessionState['cubes']) {
  (nodes ?? []).forEach((node) => {
    if (isGroup(node)) {
      const boneName = String(node.name ?? 'bone');
      bones.push({
        id: readNodeId(node),
        name: boneName,
        parent,
        pivot: toVec3(node.origin ?? node.pivot ?? [0, 0, 0]),
        rotation: toOptionalVec3(node.rotation),
        scale: toOptionalVec3(node.scale)
      });
      walkNodes(node.children ?? [], boneName, bones, cubes);
      return;
    }
    if (isCube(node)) {
      cubes.push({
        id: readNodeId(node),
        name: String(node.name ?? 'cube'),
        from: toVec3(node.from ?? [0, 0, 0]),
        to: toVec3(node.to ?? [0, 0, 0]),
        bone: parent ?? (node.parent?.name ?? 'root'),
        uv: toOptionalVec2(node.uv_offset ?? node.uv),
        inflate: node.inflate,
        mirror: node.mirror_uv ?? node.mirror
      });
    }
  });
}

function isGroup(node: any): boolean {
  if (!node) return false;
  const groupCtor = (globalThis as any).Group;
  if (groupCtor && node instanceof groupCtor) return true;
  return Array.isArray(node.children);
}

function isCube(node: any): boolean {
  if (!node) return false;
  const cubeCtor = (globalThis as any).Cube;
  if (cubeCtor && node instanceof cubeCtor) return true;
  return node.from !== undefined && node.to !== undefined;
}

function toVec3(value: Vec3Like): [number, number, number] {
  if (Array.isArray(value)) {
    return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
  }
  return [value?.x ?? 0, value?.y ?? 0, value?.z ?? 0];
}

function toOptionalVec3(value: any): [number, number, number] | undefined {
  if (!value) return undefined;
  return toVec3(value);
}

function toOptionalVec2(value: any): [number, number] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return [value[0] ?? 0, value[1] ?? 0];
  if (typeof value?.x === 'number' && typeof value?.y === 'number') return [value.x, value.y];
  return undefined;
}

function readNodeId(node: any): string | undefined {
  if (!node) return undefined;
  const raw = node.bbmcpId ?? node.uuid ?? node.id ?? node.uid ?? node._uuid ?? null;
  return raw ? String(raw) : undefined;
}

function readTextureId(tex: any): string | undefined {
  if (!tex) return undefined;
  const raw = tex.bbmcpId ?? tex.uuid ?? tex.id ?? tex.uid ?? tex._uuid ?? null;
  return raw ? String(raw) : undefined;
}

function readAnimationId(anim: any): string | undefined {
  if (!anim) return undefined;
  const raw = anim.bbmcpId ?? anim.uuid ?? anim.id ?? anim.uid ?? anim._uuid ?? null;
  return raw ? String(raw) : undefined;
}

function getProjectName(): string | null {
  const project = (globalThis as any).Project ?? (globalThis as any).Blockbench?.project ?? null;
  return project?.name ?? null;
}

function getProjectId(): string | null {
  const project = (globalThis as any).Project ?? (globalThis as any).Blockbench?.project ?? null;
  const id = project?.uuid ?? project?.id ?? project?.uid ?? null;
  return id ? String(id) : null;
}

function getProjectDirty(): boolean | undefined {
  try {
    const blockbench = (globalThis as any).Blockbench;
    if (typeof blockbench?.hasUnsavedChanges === 'function') {
      const result = blockbench.hasUnsavedChanges();
      if (typeof result === 'boolean') return result;
    }
    const project = (globalThis as any).Project ?? blockbench?.project ?? null;
    if (!project) return undefined;
    if (typeof project.saved === 'boolean') return !project.saved;
    if (typeof project.isSaved === 'boolean') return !project.isSaved;
    if (typeof project.dirty === 'boolean') return project.dirty;
    if (typeof project.isDirty === 'boolean') return project.isDirty;
    if (typeof project.unsaved === 'boolean') return project.unsaved;
    if (typeof project.hasUnsavedChanges === 'function') {
      return Boolean(project.hasUnsavedChanges());
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function getActiveFormatId(globals: SnapshotGlobals): string | null {
  const active = (globalThis as any).Format ?? globals.ModelFormat?.selected ?? null;
  return active?.id ?? null;
}

function guessFormatKind(formatId: string | null): FormatKind | null {
  if (!formatId) return null;
  const kinds: FormatKind[] = ['animated_java', 'geckolib', 'vanilla'];
  return kinds.find((kind) => matchesFormatKind(kind, formatId)) ?? null;
}

function normalizeLoop(loopValue: any): boolean {
  if (typeof loopValue === 'string') return loopValue === 'loop';
  return Boolean(loopValue);
}

function getAnimationState(globals: SnapshotGlobals): { animations: any[]; status: 'available' | 'unavailable' } {
  const global = globalThis as any;
  if (Array.isArray(global.Animations)) return { animations: global.Animations, status: 'available' };
  if (Array.isArray(globals.Animation?.all)) return { animations: globals.Animation.all, status: 'available' };
  return { animations: [], status: 'unavailable' };
}

function extractChannels(anim: any): TrackedAnimationChannel[] | undefined {
  const animators = anim?.animators ?? {};
  if (!animators || typeof animators !== 'object') return undefined;
  const channels: TrackedAnimationChannel[] = [];
  Object.entries(animators).forEach(([bone, animator]) => {
    const grouped = collectAnimatorChannels(animator as any);
    grouped.forEach((entry) => {
      channels.push({ bone, channel: entry.channel, keys: entry.keys });
    });
  });
  return channels.length > 0 ? channels : undefined;
}

function collectAnimatorChannels(animator: any): Array<{ channel: 'rot' | 'pos' | 'scale'; keys: TrackedAnimationChannel['keys'] }> {
  const buckets: Record<'rot' | 'pos' | 'scale', TrackedAnimationChannel['keys']> = {
    rot: [],
    pos: [],
    scale: []
  };
  const keyframes = Array.isArray(animator?.keyframes) ? animator.keyframes : [];
  keyframes.forEach((kf: any) => {
    const channel = normalizeChannel(kf?.channel ?? kf?.data_channel ?? kf?.transform);
    const value = kf?.data_points ?? kf?.value ?? kf?.data_point;
    if (!channel || !Array.isArray(value) || value.length < 3) return;
    buckets[channel].push({
      time: Number(kf?.time ?? kf?.frame ?? 0),
      value: [value[0], value[1], value[2]],
      interp: normalizeInterp(kf?.interpolation)
    });
  });
  return Object.entries(buckets)
    .filter(([, keys]) => keys.length > 0)
    .map(([channel, keys]) => ({ channel: channel as 'rot' | 'pos' | 'scale', keys }));
}

function normalizeChannel(value: any): 'rot' | 'pos' | 'scale' | null {
  const channel = String(value ?? '').toLowerCase();
  if (channel.includes('rot')) return 'rot';
  if (channel.includes('pos')) return 'pos';
  if (channel.includes('scale')) return 'scale';
  return null;
}

function normalizeInterp(value: any): 'linear' | 'step' | 'catmullrom' | undefined {
  const interp = String(value ?? '').toLowerCase();
  if (interp.includes('step')) return 'step';
  if (interp.includes('catmull')) return 'catmullrom';
  if (interp.includes('linear')) return 'linear';
  return undefined;
}

function ensureRootBone(bones: SessionState['bones'], cubes: SessionState['cubes']) {
  const needsRoot = cubes.some((cube) => cube.bone === 'root');
  if (!needsRoot) return;
  const hasRoot = bones.some((bone) => bone.name === 'root');
  if (hasRoot) return;
  bones.unshift({ id: 'root', name: 'root', pivot: [0, 0, 0] });
}
