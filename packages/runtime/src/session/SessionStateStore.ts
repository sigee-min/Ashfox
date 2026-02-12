import type { ToolError, ToolResponse } from '@ashfox/contracts/types/internal';
import { err } from '../shared/tooling/toolResponse';
import { PROJECT_NO_ACTIVE } from '../shared/messages';
import type { SessionState } from './types';
import { resolveAnimationTimePolicy } from '../domain/animation/timePolicy';
import { cloneAnimations } from './clone';

const createEmptyState = (policy = resolveAnimationTimePolicy()): SessionState => ({
  id: null,
  formatId: null,
  name: null,
  dirty: undefined,
  uvPixelsPerBlock: undefined,
  bones: [],
  cubes: [],
  meshes: [],
  textures: [],
  animations: [],
  animationsStatus: 'available',
  animationTimePolicy: { ...policy }
});

export class SessionStateStore {
  private state: SessionState = createEmptyState();

  create(
    name: string,
    formatId?: string | null
  ): ToolResponse<{ id: string; name: string }> {
    const id = `${Date.now()}`;
    const animationTimePolicy = { ...this.state.animationTimePolicy };
    this.state = {
      id,
      formatId: formatId ?? null,
      name,
      dirty: undefined,
      uvPixelsPerBlock: undefined,
      bones: [],
      cubes: [],
      meshes: [],
      textures: [],
      animations: [],
      animationsStatus: 'available',
      animationTimePolicy
    };
    return { ok: true, data: { id, name } };
  }

  attach(snapshot: SessionState): ToolResponse<{ id: string; name: string | null }> {
    if (!hasProjectData(snapshot)) {
      return err<{ id: string; name: string | null }>('invalid_state', PROJECT_NO_ACTIVE);
    }
    const id = snapshot.id ?? `${Date.now()}`;
    const name = snapshot.name ?? null;
    const animationTimePolicy = resolveAnimationTimePolicy(snapshot.animationTimePolicy ?? this.state.animationTimePolicy);
    this.state = {
      id,
      formatId: snapshot.formatId ?? null,
      name,
      dirty: snapshot.dirty,
      uvPixelsPerBlock: snapshot.uvPixelsPerBlock,
      bones: [...snapshot.bones],
      cubes: [...snapshot.cubes],
      meshes: [...(snapshot.meshes ?? [])],
      textures: [...snapshot.textures],
      animations: cloneAnimations(snapshot.animations),
      animationsStatus: snapshot.animationsStatus ?? 'available',
      animationTimePolicy
    };
    return { ok: true, data: { id, name } };
  }

  reset(): ToolResponse<{ ok: true }> {
    this.state = createEmptyState(this.state.animationTimePolicy);
    return { ok: true, data: { ok: true } };
  }

  snapshot(): SessionState {
    return {
      ...this.state,
      bones: [...this.state.bones],
      cubes: [...this.state.cubes],
      meshes: [...(this.state.meshes ?? [])],
      textures: [...this.state.textures],
      animations: cloneAnimations(this.state.animations),
      animationsStatus: this.state.animationsStatus,
      animationTimePolicy: { ...this.state.animationTimePolicy }
    };
  }

  ensureActive(): ToolError | null {
    if (!hasProjectData(this.state)) {
      return { code: 'invalid_state', message: PROJECT_NO_ACTIVE, details: { reason: 'no_active_project' } };
    }
    return null;
  }

  getState(): SessionState {
    return this.state;
  }

  setAnimationTimePolicy(policy?: Partial<typeof this.state.animationTimePolicy>) {
    if (!policy) return;
    this.state.animationTimePolicy = resolveAnimationTimePolicy({
      ...this.state.animationTimePolicy,
      ...policy
    });
  }

  setUvPixelsPerBlock(value?: number) {
    this.state.uvPixelsPerBlock = value;
  }
}

const hasProjectData = (snapshot: SessionState): boolean =>
  Boolean(
    snapshot.id ||
    snapshot.formatId ||
    snapshot.name ||
    snapshot.bones.length > 0 ||
    snapshot.cubes.length > 0 ||
    (snapshot.meshes?.length ?? 0) > 0 ||
    snapshot.textures.length > 0 ||
    snapshot.animations.length > 0
  );
