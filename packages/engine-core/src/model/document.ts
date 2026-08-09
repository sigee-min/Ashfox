import type { AuthoringProfile } from '../authoring/contract';
import type { AnimationClip } from './motion';
import type {
  AssetId,
  ClipId,
  ProjectId,
  ProjectSettings,
  Revision,
  PROJECT_DOCUMENT_SCHEMA_VERSION
} from './identity';
import type { ProjectIntent } from './intent';
import type { ConstrainedModelRecipe } from './part';
import type { SceneGraph } from './scene';
import type { IntentProgramSource } from './source';
import type { TextureAsset } from './texture';

export interface ProjectDocument {
  schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION;
  id: ProjectId;
  name: string;
  revision: Revision;
  settings: ProjectSettings;
  /** Compiled semantic authority; all downstream fields are derived. */
  intentProgram?: IntentProgramSource;
  /** Agent-staged source awaiting an Agent compile-or-revise decision. */
  intentProgramProposal?: IntentProgramSource;
  intent?: ProjectIntent;
  authoringProfile?: AuthoringProfile;
  modeling?: ConstrainedModelRecipe;
  scene: SceneGraph;
  textures: Readonly<Record<AssetId, TextureAsset>>;
  animations: Readonly<Record<ClipId, AnimationClip>>;
  createdAt: string;
  updatedAt: string;
}
