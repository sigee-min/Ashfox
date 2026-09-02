import {
  executeAgentCommandBatch,
  executeWebCommandBatch,
  type AssetProject,
  type CommandBatch,
  type CommandReceipt
} from '@ashfox/engine-core';

import {
  compareProjectRevisions,
  isLocalProjectRevision,
  localProjectRevisionForSerial,
  projectRevisionSerial
} from './localProjectRecord';
import {
  areAssetProjectsEqual,
  type ProjectSnapshot
} from './snapshot';
import {
  boundedCommandFindings,
  type CommandOutcome
} from './commandOutcome';
import { createCommandReceipt } from './createCommandReceipt';
import { LOCAL_COMMAND_ACTOR_ID } from './localCommandActor';

const HISTORY_LIMIT = 50;
const ACTIVITY_LIMIT = 100;
const COMMAND_OUTCOME_LIMIT = 32;

export interface HistoryState {
  past: AssetProject[];
  present: AssetProject;
  future: AssetProject[];
  serial: number;
  activity: CommandReceipt[];
  lastCommandOutcome: CommandOutcome | null;
  commandOutcomes: readonly CommandOutcome[];
}

export type HistoryAction =
  | { type: 'execute'; batch: CommandBatch; actorId: string;
      source: 'agent' | 'web'; committedAt: string }
  | { type: 'undo'; commandId: string; committedAt: string }
  | { type: 'redo'; commandId: string; committedAt: string }
  | { type: 'hydrate'; record: ProjectSnapshot }
  | { type: 'external'; record: ProjectSnapshot };

export const createHistoryState = (project: AssetProject): HistoryState => ({
  past: [],
  present: project,
  future: [],
  serial: projectRevisionSerial(project.revision),
  activity: [],
  lastCommandOutcome: null,
  commandOutcomes: []
});

export const localRevisionForSerial = localProjectRevisionForSerial;

/** Stamp both layers exactly once; document remains a derived projection. */
const stampProject = (
  project: AssetProject,
  serial: number,
  updatedAt: string
): AssetProject => Object.freeze({
  ...project,
  revision: localRevisionForSerial(serial),
  updatedAt,
  document: Object.freeze({
    ...project.document,
    revision: localRevisionForSerial(serial),
    updatedAt
  })
});

const prependActivity = (
  state: HistoryState,
  receipt: CommandReceipt
): CommandReceipt[] => [receipt, ...state.activity].slice(0, ACTIVITY_LIMIT);

const prependCommandOutcome = (
  state: HistoryState,
  outcome: CommandOutcome
): readonly CommandOutcome[] => [
  outcome,
  ...state.commandOutcomes.filter((entry) => entry.commandId !== outcome.commandId)
].slice(0, COMMAND_OUTCOME_LIMIT);

const historyReceipt = (
  state: HistoryState,
  present: AssetProject,
  commandId: string,
  completedAt: string,
  summary: string
): CommandReceipt => createCommandReceipt({
  commandId,
  projectId: present.id,
  source: 'web',
  actorId: LOCAL_COMMAND_ACTOR_ID,
  summary,
  beforeRevision: state.present.revision,
  revision: present.revision,
  completedAt,
  effects: {
    createdEntityIds: [],
    changedEntityIds: [],
    removedEntityIds: [],
    invalidated: ['scene', 'textures', 'animations', 'validation', 'preview']
  },
  findings: []
});

const hydrateHistory = (
  state: HistoryState,
  record: ProjectSnapshot
): HistoryState => {
  const project = record.project;
  if (project.id !== state.present.id) {
    const serial = projectRevisionSerial(project.revision);
    return {
      past: [],
      present: isLocalProjectRevision(project.revision)
        ? project
        : stampProject(project, serial, record.savedAt),
      future: [],
      serial,
      activity: [...record.activity],
      lastCommandOutcome: null,
      commandOutcomes: state.commandOutcomes
    };
  }
  if (areAssetProjectsEqual(project, state.present)) {
    return { ...state, activity: [...record.activity], lastCommandOutcome: null };
  }
  const recordSerial = projectRevisionSerial(project.revision);
  const serial = recordSerial <= state.serial ? state.serial + 1 : recordSerial;
  return {
    past: [],
    present: serial === recordSerial
      ? project
      : stampProject(project, serial, record.savedAt),
    future: [],
    serial,
    activity: [...record.activity],
    lastCommandOutcome: null,
    commandOutcomes: state.commandOutcomes
  };
};

const receiveExternalHistory = (
  state: HistoryState,
  record: ProjectSnapshot
): HistoryState => {
  if (record.project.id !== state.present.id || compareProjectRevisions(
    record.project.revision, state.present.revision
  ) <= 0) return state;
  return {
    past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.present],
    present: record.project,
    future: [],
    serial: Math.max(state.serial, projectRevisionSerial(record.project.revision)),
    activity: [...record.activity],
    lastCommandOutcome: null,
    commandOutcomes: state.commandOutcomes
  };
};

const undoHistory = (
  state: HistoryState,
  action: Extract<HistoryAction, { type: 'undo' }>
): HistoryState => {
  const previous = state.past.at(-1);
  if (!previous) return state;
  const present = stampProject(previous, state.serial + 1, action.committedAt);
  return {
    past: state.past.slice(0, -1),
    present,
    future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
    serial: state.serial + 1,
    activity: prependActivity(state, historyReceipt(
      state, present, action.commandId, action.committedAt, 'Undo last command'
    )),
    lastCommandOutcome: null,
    commandOutcomes: state.commandOutcomes
  };
};

const redoHistory = (
  state: HistoryState,
  action: Extract<HistoryAction, { type: 'redo' }>
): HistoryState => {
  const next = state.future[0];
  if (!next) return state;
  const present = stampProject(next, state.serial + 1, action.committedAt);
  return {
    past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.present],
    present,
    future: state.future.slice(1),
    serial: state.serial + 1,
    activity: prependActivity(state, historyReceipt(
      state, present, action.commandId, action.committedAt, 'Redo command'
    )),
    lastCommandOutcome: null,
    commandOutcomes: state.commandOutcomes
  };
};

const executeBatch = (
  state: HistoryState,
  action: Extract<HistoryAction, { type: 'execute' }>
): HistoryState => {
  let result;
  try {
    const executeForSource = action.source === 'agent'
      ? executeAgentCommandBatch : executeWebCommandBatch;
    result = executeForSource(state.present, action.batch);
  } catch (error) {
    const outcome: CommandOutcome = {
      status: 'rejected', commandId: action.batch.batchId,
      revision: state.present.revision,
      error: { code: 'invalid_state', message: error instanceof Error
        ? `Command execution failed: ${error.message}` : 'Command execution failed.' }
    };
    return { ...state, lastCommandOutcome: outcome,
      commandOutcomes: prependCommandOutcome(state, outcome) };
  }
  if (!result.ok) {
    const outcome: CommandOutcome = {
      status: 'rejected', commandId: action.batch.batchId,
      revision: state.present.revision, error: result.error,
      ...boundedCommandFindings(result.findings)
    };
    return { ...state, lastCommandOutcome: outcome,
      commandOutcomes: prependCommandOutcome(state, outcome) };
  }
  const serial = state.serial + 1;
  const present = stampProject(result.project, serial, action.committedAt);
  const replacesProject = result.project.id !== state.present.id;
  const receipt = createCommandReceipt({
    commandId: action.batch.batchId,
    projectId: present.id,
    source: action.source,
    actorId: action.actorId,
    summary: result.summary,
    beforeRevision: state.present.revision,
    revision: present.revision,
    completedAt: action.committedAt,
    effects: result.effects,
    findings: result.findings
  });
  const outcome: CommandOutcome = { status: 'committed', commandId: action.batch.batchId, receipt };
  return {
    past: replacesProject ? [] : [...state.past.slice(-(HISTORY_LIMIT - 1)), state.present],
    present,
    future: [],
    serial,
    activity: replacesProject ? [receipt] : prependActivity(state, receipt),
    lastCommandOutcome: outcome,
    commandOutcomes: prependCommandOutcome(state, outcome)
  };
};

export const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
  switch (action.type) {
    case 'hydrate': return hydrateHistory(state, action.record);
    case 'external': return receiveExternalHistory(state, action.record);
    case 'undo': return undoHistory(state, action);
    case 'redo': return redoHistory(state, action);
    case 'execute': return executeBatch(state, action);
  }
};
