import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import {
  GIF_CAPTURE_FPS,
  MAX_GIF_CAPTURE_FRAMES
} from './gifFramePlan';

export type BuildCaptureCategory =
  | 'start'
  | 'project'
  | 'geometry'
  | 'rig'
  | 'texture'
  | 'animation'
  | 'complete';

export interface BuildCaptureEvent {
  id: string;
  category: BuildCaptureCategory;
  label: string;
  document: ProjectDocument;
  createdEntityIds: readonly string[];
  revisionCount: number;
  affectedEntityCount: number;
  holdFrames: number;
}

export interface BuildCaptureFrame {
  index: number;
  eventIndex: number;
  eventFrameIndex: number;
  event: BuildCaptureEvent;
  progress: number;
}

export interface BuildCapturePlan {
  fps: number;
  events: readonly BuildCaptureEvent[];
  frames: readonly BuildCaptureFrame[];
}

const HOLD_FRAMES: Readonly<Record<BuildCaptureCategory, number>> = {
  start: 8,
  project: 4,
  geometry: 12,
  rig: 6,
  texture: 8,
  animation: 10,
  complete: 18
};

const GROUP_LIMIT: Readonly<Record<BuildCaptureCategory, number>> = {
  start: 1,
  project: 2,
  geometry: 1,
  rig: 3,
  texture: 2,
  animation: 2,
  complete: 1
};

const categoryLabel = (
  category: BuildCaptureCategory,
  affectedEntityCount: number
): string => {
  const label = {
    start: 'Starting scene',
    project: 'Project configured',
    geometry: 'Shape assembled',
    rig: 'Rig and hierarchy established',
    texture: 'UV and materials applied',
    animation: 'Motion authored',
    complete: 'Ready to inspect and export'
  }[category];
  if (
    affectedEntityCount === 0 ||
    category === 'start' ||
    category === 'complete'
  ) {
    return label;
  }
  return `${label} · ${affectedEntityCount} ${
    affectedEntityCount === 1 ? 'entity' : 'entities'
  }`;
};

const affectedEntityCount = (receipt?: CommandReceipt): number =>
  receipt
    ? receipt.effects.createdEntityIds.length +
      receipt.effects.changedEntityIds.length +
      receipt.effects.removedEntityIds.length
    : 0;

const changedRecord = (
  before: object,
  after: object
): boolean => JSON.stringify(before) !== JSON.stringify(after);

const inferCategory = (
  before: ProjectDocument,
  after: ProjectDocument,
  receipt?: CommandReceipt
): BuildCaptureCategory => {
  const invalidated = new Set(receipt?.effects.invalidated ?? []);
  const summary = receipt?.summary.toLowerCase() ?? '';
  const texturesChanged = changedRecord(before.textures, after.textures);
  const animationsChanged = changedRecord(
    before.animations,
    after.animations
  );
  const sceneChanged = changedRecord(before.scene, after.scene);
  if (/texture|material|uv|atlas|paint|raster/.test(summary)) {
    return 'texture';
  }
  if (animationsChanged) {
    return 'animation';
  }

  const createdIds = receipt?.effects.createdEntityIds ?? [];
  const createdBone = createdIds.some(
    (id) => after.scene.nodes[id]?.kind === 'bone'
  );
  if (
    createdBone ||
    /bone|rig|skeleton|hierarch|reparent/.test(summary)
  ) {
    return 'rig';
  }
  if (sceneChanged) {
    return 'geometry';
  }
  if (
    texturesChanged ||
    invalidated.has('textures') ||
    invalidated.has('uv')
  ) return 'texture';
  if (invalidated.has('animations')) return 'animation';
  if (invalidated.has('scene')) return 'geometry';
  return 'project';
};

interface CandidateEvent {
  category: BuildCaptureCategory;
  document: ProjectDocument;
  createdEntityIds: string[];
  affectedEntityCount: number;
  completedAt: number | null;
}

const createdEntityIds = (
  before: ProjectDocument,
  after: ProjectDocument,
  receipt?: CommandReceipt
): string[] => {
  const recorded = receipt?.effects.createdEntityIds.filter(
    (id) => after.scene.nodes[id] !== undefined
  ) ?? [];
  if (recorded.length > 0) return [...new Set(recorded)];
  return Object.keys(after.scene.nodes).filter(
    (id) => before.scene.nodes[id] === undefined
  );
};

const hasRenderableGeometry = (
  document: ProjectDocument
): boolean =>
  Object.values(document.scene.nodes).some(
    (node) =>
      node.visible &&
      (node.kind === 'cube' || node.kind === 'mesh')
  );

const receiptTimestamp = (
  receipt?: CommandReceipt
): number | null => {
  if (!receipt) return null;
  const timestamp = Date.parse(receipt.completedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const shouldGroup = (
  previous: CandidateEvent & { revisionCount: number },
  next: CandidateEvent
): boolean => {
  if (previous.category !== next.category) return false;
  if (previous.revisionCount >= GROUP_LIMIT[previous.category]) return false;
  if (previous.completedAt === null || next.completedAt === null) return true;
  return next.completedAt - previous.completedAt <= 2_000;
};

const buildSemanticEvents = (
  documents: readonly ProjectDocument[],
  receipts: readonly CommandReceipt[]
): BuildCaptureEvent[] => {
  const receiptByRevision = new Map(
    receipts.map((receipt) => [receipt.revision, receipt])
  );
  const grouped: Array<CandidateEvent & { revisionCount: number }> = [];

  for (let index = 1; index < documents.length; index += 1) {
    const before = documents[index - 1];
    const document = documents[index];
    if (!before || !document || before.revision === document.revision) continue;
    const receipt = receiptByRevision.get(document.revision);
    const candidate: CandidateEvent = {
      category: inferCategory(before, document, receipt),
      document,
      createdEntityIds: createdEntityIds(before, document, receipt),
      affectedEntityCount: affectedEntityCount(receipt),
      completedAt: receiptTimestamp(receipt)
    };
    const previous = grouped.at(-1);
    if (previous && shouldGroup(previous, candidate)) {
      previous.document = candidate.document;
      previous.createdEntityIds = [...new Set([
        ...previous.createdEntityIds,
        ...candidate.createdEntityIds
      ])];
      previous.affectedEntityCount += candidate.affectedEntityCount;
      previous.completedAt = candidate.completedAt;
      previous.revisionCount += 1;
      continue;
    }
    grouped.push({ ...candidate, revisionCount: 1 });
  }

  const first = documents[0];
  const last = documents.at(-1);
  if (!first || !last) return [];
  const visibleEvents = grouped.filter(
    (event) =>
      hasRenderableGeometry(event.document) ||
      (event.category !== 'rig' && event.category !== 'project')
  );
  const startLabel =
    Object.keys(first.scene.nodes).length === 0
      ? 'Starting from an empty scene'
      : 'Starting from the current scene';
  return [
    {
      id: `start:${first.revision}`,
      category: 'start',
      label: startLabel,
      document: first,
      createdEntityIds: [],
      revisionCount: 1,
      affectedEntityCount: 0,
      holdFrames: HOLD_FRAMES.start
    },
    ...visibleEvents.map((event, index) => ({
      id: `${event.category}:${event.document.revision}:${index}`,
      category: event.category,
      label: categoryLabel(
        event.category,
        event.affectedEntityCount
      ),
      document: event.document,
      createdEntityIds: event.createdEntityIds,
      revisionCount: event.revisionCount,
      affectedEntityCount: event.affectedEntityCount,
      holdFrames: HOLD_FRAMES[event.category]
    })),
    {
      id: `complete:${last.revision}`,
      category: 'complete',
      label: categoryLabel('complete', 0),
      document: last,
      createdEntityIds: [],
      revisionCount: 1,
      affectedEntityCount: 0,
      holdFrames: HOLD_FRAMES.complete
    }
  ];
};

const fitEventFrames = (
  events: readonly BuildCaptureEvent[]
): BuildCaptureEvent[] => {
  const requested = events.reduce(
    (total, event) => total + event.holdFrames,
    0
  );
  if (requested <= MAX_GIF_CAPTURE_FRAMES) return [...events];
  const scale = MAX_GIF_CAPTURE_FRAMES / requested;
  return events.map((event) => ({
    ...event,
    holdFrames: Math.max(
      event.category === 'complete' ? 5 : 2,
      Math.floor(event.holdFrames * scale)
    )
  }));
};

export const createBuildCapturePlan = (
  documents: readonly ProjectDocument[],
  receipts: readonly CommandReceipt[],
  fps = GIF_CAPTURE_FPS
): BuildCapturePlan => {
  if (!Number.isInteger(fps) || fps <= 0) {
    throw new Error('GIF capture FPS must be a positive integer.');
  }
  if (documents.length < 2) {
    throw new Error(
      'Build process capture needs at least one committed change in this session.'
    );
  }

  const events = fitEventFrames(buildSemanticEvents(documents, receipts));
  const frames: BuildCaptureFrame[] = [];
  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    if (!event) continue;
    for (
      let eventFrameIndex = 0;
      eventFrameIndex < event.holdFrames;
      eventFrameIndex += 1
    ) {
      frames.push({
        index: frames.length,
        eventIndex,
        eventFrameIndex,
        event,
        progress: 0
      });
    }
  }
  const lastFrameIndex = Math.max(1, frames.length - 1);
  return {
    fps,
    events,
    frames: frames.map((frame) => ({
      ...frame,
      progress: frame.index / lastFrameIndex
    }))
  };
};
