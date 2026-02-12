import { ProjectInfo, ProjectState, ProjectStateDetail } from '@ashfox/contracts/types/internal';
import { FormatPort } from '../../ports/formats';
import { SessionState } from '../../session';

export class ProjectStateBuilder {
  private readonly formats: FormatPort;

  constructor(formats: FormatPort) {
    this.formats = formats;
  }

  normalize(snapshot: SessionState): SessionState {
    const normalized = { ...snapshot };
    if (!normalized.formatId) {
      normalized.formatId = this.formats.getActiveFormatId();
    }
    return normalized;
  }

  toProjectInfo(snapshot: SessionState): ProjectInfo | null {
    const hasData =
      snapshot.id ||
      snapshot.formatId ||
      snapshot.name ||
      snapshot.bones.length > 0 ||
      snapshot.cubes.length > 0 ||
      (snapshot.meshes?.length ?? 0) > 0 ||
      snapshot.textures.length > 0 ||
      snapshot.animations.length > 0;
    if (!hasData) return null;
    return {
      id: snapshot.id ?? 'active',
      name: snapshot.name ?? null,
      formatId: snapshot.formatId ?? null
    };
  }

  buildProjectState(
    snapshot: SessionState,
    detail: ProjectStateDetail,
    active: boolean,
    revision: string
  ): ProjectState {
    const counts = {
      bones: snapshot.bones.length,
      cubes: snapshot.cubes.length,
      meshes: snapshot.meshes?.length ?? 0,
      meshVertices: (snapshot.meshes ?? []).reduce((acc, mesh) => acc + mesh.vertices.length, 0),
      meshFaces: (snapshot.meshes ?? []).reduce((acc, mesh) => acc + mesh.faces.length, 0),
      textures: snapshot.textures.length,
      animations: snapshot.animations.length
    };
    const project: ProjectState = {
      id: active ? snapshot.id ?? 'active' : 'none',
      active,
      name: snapshot.name ?? null,
      formatId: snapshot.formatId ?? null,
      dirty: snapshot.dirty,
      revision,
      uvPixelsPerBlock: snapshot.uvPixelsPerBlock,
      counts
    };
    if (snapshot.textures.length > 0) {
      project.textures = snapshot.textures;
    }
    if (detail === 'full') {
      project.bones = snapshot.bones;
      project.cubes = snapshot.cubes;
      project.meshes = snapshot.meshes;
      project.animations = snapshot.animations;
    }
    return project;
  }

}

