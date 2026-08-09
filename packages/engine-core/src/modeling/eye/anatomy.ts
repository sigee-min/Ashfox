import type {
  ModelPartFace
} from '../../model';
import {
  type FeaturePartSpec,
  type PartSpec
} from '../part';

export type EyeAnatomyIssueCode =
  | 'parent-volume'
  | 'forward-face';

export interface EyeAnatomyIssue {
  code: EyeAnatomyIssueCode;
  eyePartId: string;
  field: 'parentPartId' | 'face';
  message: string;
}

export interface EyeAnatomyAuditOptions {
  requiredFace?: ModelPartFace;
}

const oppositeFace = (face: ModelPartFace): ModelPartFace => {
  switch (face) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    case 'west':
      return 'east';
    case 'up':
      return 'down';
    case 'down':
      return 'up';
  }
};

const auditEye = (
  eye: FeaturePartSpec,
  partsById: ReadonlyMap<string, PartSpec>,
  options: EyeAnatomyAuditOptions
): readonly EyeAnatomyIssue[] => {
  const issues: EyeAnatomyIssue[] = [];
  const host = eye.parentPartId === null
    ? undefined
    : partsById.get(eye.parentPartId);
  if (host?.kind !== 'mass' && host?.kind !== 'segment') {
    return [{
      code: 'parent-volume',
      eyePartId: eye.partId,
      field: 'parentPartId',
      message:
        'An eye feature requires a volumetric mass or segment parent. ' +
        'A plate, radial, detached mask, or billboard has no supported face template.'
    }];
  }

  if (
    options.requiredFace &&
    eye.face === oppositeFace(options.requiredFace)
  ) {
    issues.push({
      code: 'forward-face',
      eyePartId: eye.partId,
      field: 'face',
      message:
        `Eye "${eye.partId}" faces directly away from this audited ` +
        `asset's declared ${options.requiredFace} forward direction.`
    });
  }
  return issues;
};

/**
 * Structural eye-template audit. Pixel roles, proportions, and the nearest
 * valid host-surface placement are compiler-owned grammar.
 */
export const auditEyeAnatomy = (
  parts: readonly PartSpec[],
  options: EyeAnatomyAuditOptions = {}
): readonly EyeAnatomyIssue[] => {
  const partsById = new Map(parts.map((part) => [part.partId, part]));
  return parts
    .filter(
      (part): part is FeaturePartSpec =>
        part.kind === 'feature' && part.motif === 'eye'
    )
    .flatMap((eye) => auditEye(eye, partsById, options));
};
