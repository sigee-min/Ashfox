import { INTERNAL_CONTRACT_VERSIONS } from '@ashfox/internal-contracts';

import type {
  EntityId,
  ProjectDocument,
  ProjectId,
  Revision,
  SurfacePixelDensity
} from '../model';
import type { InvariantFinding } from '../validation';

export const COMMAND_RECEIPT_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.commandReceipt;

export const COMMAND_SOURCES = [
  'web',
  'agent',
  'import',
  'system'
] as const;
export type CommandSource = (typeof COMMAND_SOURCES)[number];

export interface ProjectCreateInput {
  name: string;
  density?: 1;
}

/** Internal input used while creating a project from its canonical settings. */
export interface ProjectDocumentCreateInput {
  id: ProjectId;
  name: string;
  createdAt: string;
  density?: SurfacePixelDensity;
}

export interface IntentProgramProposalInput {
  source: string;
}

export interface IntentProgramCompileInput {
  /** Hash shown with the pending draft, preventing compilation of another source. */
  hash: string;
}

/**
 * The complete mutation surface. Geometry, materials, authoring profiles, and
 * animation are compiler output, never commands that a caller can issue.
 */
export interface CommandPayloadMap {
  'project.create': ProjectCreateInput;
  'project.rename': {
    name: string;
  };
  'intent.program.propose': IntentProgramProposalInput;
  'intent.program.compile': IntentProgramCompileInput;
}

export type CommandName = keyof CommandPayloadMap;

export type ProjectCommandOperation = {
  [TName in CommandName]: {
    name: TName;
    payload: CommandPayloadMap[TName];
  };
}[CommandName];

export interface CommandEnvelope<TName extends CommandName> {
  commandId: string;
  idempotencyKey: string;
  projectId: ProjectId;
  actorId: string;
  source: CommandSource;
  baseRevision: Revision;
  name: TName;
  payload: CommandPayloadMap[TName];
  traceId?: string;
}

export type ProjectCommand = {
  [TName in CommandName]: CommandEnvelope<TName>;
}[CommandName];

export interface CommandBatch {
  batchId: string;
  baseProjectId: ProjectId;
  baseRevision: Revision;
  operations: readonly ProjectCommandOperation[];
}

export const COMMAND_INVALIDATED_AREAS = [
  'scene',
  'textures',
  'uv',
  'animations',
  'validation',
  'preview'
] as const;
export type InvalidatedArea =
  (typeof COMMAND_INVALIDATED_AREAS)[number];

export interface CommandEffects {
  createdEntityIds: readonly EntityId[];
  changedEntityIds: readonly EntityId[];
  removedEntityIds: readonly EntityId[];
  invalidated: readonly InvalidatedArea[];
}

export interface CommandReceipt {
  schemaVersion: typeof COMMAND_RECEIPT_SCHEMA_VERSION;
  commandId: string;
  projectId: ProjectId;
  actorId: string;
  source: CommandSource;
  summary: string;
  beforeRevision: Revision;
  revision: Revision;
  completedAt: string;
  durationMs: number;
  effects: CommandEffects;
  findings: readonly InvariantFinding[];
}

export type CommandErrorCode =
  | 'invalid_batch'
  | 'invalid_payload'
  | 'invalid_state'
  | 'project_mismatch'
  | 'revision_mismatch'
  | 'no_change';

export interface CommandError {
  code: CommandErrorCode;
  message: string;
  path?: string;
  expected?: string;
}

export interface CommandBatchSuccess {
  ok: true;
  document: ProjectDocument;
  summary: string;
  effects: CommandEffects;
  findings: readonly InvariantFinding[];
}

export interface CommandBatchFailure {
  ok: false;
  currentRevision: Revision;
  error: CommandError;
  findings?: readonly InvariantFinding[];
}

export type CommandBatchResult =
  | CommandBatchSuccess
  | CommandBatchFailure;
