import {
  reflectProjectPoint,
  type ProjectSpatialFrame
} from '../project/projectSpatialFrame';
import type {
  GeometryPartSpec,
  PartSpec
} from './partContract';

/** A compiler-owned pair derives the second attachment by reflection. */
export interface PartAttachmentReflectionPair {
  sourcePartId: string;
  reflectedPartId: string;
}

export interface PartAttachmentReflectionPlan {
  frame: ProjectSpatialFrame;
  pairs: readonly PartAttachmentReflectionPair[];
}

export interface AttachmentReflectionMaps {
  sourceByReflected: ReadonlyMap<string, string>;
  reflectedBySource: ReadonlyMap<string, string>;
}

export interface AttachmentReflectionFailure {
  ok: false;
  path: string;
  message: string;
}

export const attachmentReflectionMaps = (
  parts: readonly PartSpec[],
  reflection: PartAttachmentReflectionPlan | undefined
): AttachmentReflectionMaps | AttachmentReflectionFailure => {
  if (!reflection) {
    return {
      sourceByReflected: new Map(),
      reflectedBySource: new Map()
    };
  }
  if (reflection.frame.plane === null) {
    return {
      ok: false,
      path: 'parts',
      message:
        'Compiler attachment reflection requires a bilateral project plane.'
    };
  }
  const knownPartIds = new Set(parts.map((part) => part.partId));
  const sourceByReflected = new Map<string, string>();
  const reflectedBySource = new Map<string, string>();
  for (const pair of reflection.pairs) {
    if (
      pair.sourcePartId === pair.reflectedPartId ||
      !knownPartIds.has(pair.sourcePartId) ||
      !knownPartIds.has(pair.reflectedPartId) ||
      sourceByReflected.has(pair.reflectedPartId) ||
      reflectedBySource.has(pair.sourcePartId)
    ) {
      return {
        ok: false,
        path: 'parts',
        message:
          'Compiler attachment reflection must contain unique existing source and counterpart parts.'
      };
    }
    sourceByReflected.set(pair.reflectedPartId, pair.sourcePartId);
    reflectedBySource.set(pair.sourcePartId, pair.reflectedPartId);
  }
  return { sourceByReflected, reflectedBySource };
};

export const withReflectedDerivedAttachment = (
  part: GeometryPartSpec,
  source: GeometryPartSpec,
  frame: ProjectSpatialFrame
): GeometryPartSpec | null => {
  if (source.attachment === null) return null;
  return {
    ...part,
    attachment: {
      parentAnchor: reflectProjectPoint(
        source.attachment.parentAnchor,
        frame
      ),
      partAnchor: reflectProjectPoint(
        source.attachment.partAnchor,
        frame
      )
    }
  };
};
