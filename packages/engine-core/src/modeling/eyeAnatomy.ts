import type {
  ModelPartFace
} from '../model';
import {
  type FeaturePartSpec,
  type GeometryPartSpec,
  type PartSpec
} from './partContract';
import {
  partTranslation
} from './partPrimitiveAdapter';

type AxisIndex = 0 | 1 | 2;

interface FaceAxes {
  normal: AxisIndex;
  u: AxisIndex;
  v: AxisIndex;
  positive: boolean;
}

interface PartBounds {
  minimum: readonly [number, number, number];
  maximum: readonly [number, number, number];
}

export const EYE_ANATOMY_POLICY = Object.freeze({
  minimumHostDepthCells: 4,
  maximumMinorSpanToDepthRatio: 2,
  minimumSurfaceBorderCells: 1,
  minimumSupportVolumeNumerator: 1,
  minimumSupportVolumeDenominator: 10,
  maximumHostDepthToSupportMinorSpanRatio: 2
});

export type EyeAnatomyIssueCode =
  | 'parent-volume'
  | 'detached-host'
  | 'support-volume'
  | 'host-depth'
  | 'surface-plane'
  | 'surface-border'
  | 'forward-face';

export interface EyeAnatomyIssue {
  code: EyeAnatomyIssueCode;
  eyePartId: string;
  field: 'parentPartId' | 'face' | 'anchor' | 'size';
  message: string;
}

export interface EyeAnatomyAuditOptions {
  requiredFace?: ModelPartFace;
}

const faceAxes = (face: ModelPartFace): FaceAxes => {
  switch (face) {
    case 'north':
      return { normal: 2, u: 0, v: 1, positive: false };
    case 'south':
      return { normal: 2, u: 0, v: 1, positive: true };
    case 'east':
      return { normal: 0, u: 2, v: 1, positive: true };
    case 'west':
      return { normal: 0, u: 2, v: 1, positive: false };
    case 'up':
      return { normal: 1, u: 0, v: 2, positive: true };
    case 'down':
      return { normal: 1, u: 0, v: 2, positive: false };
  }
};

const geometryBounds = (
  part: GeometryPartSpec
): PartBounds | null => {
  const translation = partTranslation(part);
  const offset = [
    translation.x,
    translation.y,
    translation.z
  ] as const;
  if (part.kind === 'mass') {
    return {
      minimum: part.center.map(
        (coordinate, axis) =>
          coordinate - part.radii[axis] + offset[axis]
      ) as [number, number, number],
      maximum: part.center.map(
        (coordinate, axis) =>
          coordinate + part.radii[axis] + offset[axis]
      ) as [number, number, number]
    };
  }
  if (part.kind !== 'segment') return null;
  const minimum: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY
  ];
  const maximum: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  ];
  part.points.forEach((point, pointIndex) => {
    for (let axis = 0; axis < 3; axis += 1) {
      const radius = part.radii[pointIndex][axis];
      minimum[axis] = Math.min(
        minimum[axis],
        point[axis] - radius + offset[axis]
      );
      maximum[axis] = Math.max(
        maximum[axis],
        point[axis] + radius + offset[axis]
      );
    }
  });
  return { minimum, maximum };
};

const featureMinimum = (
  feature: FeaturePartSpec,
  axis: AxisIndex,
  size: number
): number => feature.anchor[axis] - Math.floor(size / 2);

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
        'A plate, radial, detached mask, or billboard is not face anatomy.'
    }];
  }

  const support = host.parentPartId === null
    ? undefined
    : partsById.get(host.parentPartId);
  if (support?.kind !== 'mass' && support?.kind !== 'segment') {
    issues.push({
      code: 'detached-host',
      eyePartId: eye.partId,
      field: 'parentPartId',
      message:
        `Eye host "${host.partId}" must be a child of a second ` +
        'volumetric cranial, body, or display-housing part. A standalone ' +
        'face volume is still a detached mask.'
    });
  }

  const bounds = geometryBounds(host);
  if (!bounds) return issues;
  const axes = faceAxes(eye.face);
  const spans = bounds.maximum.map(
    (coordinate, axis) => coordinate - bounds.minimum[axis]
  );
  const depth = spans[axes.normal];
  const minorSurfaceSpan = Math.min(spans[axes.u], spans[axes.v]);
  if (
    depth < EYE_ANATOMY_POLICY.minimumHostDepthCells ||
    depth * EYE_ANATOMY_POLICY.maximumMinorSpanToDepthRatio <
      minorSurfaceSpan
  ) {
    issues.push({
      code: 'host-depth',
      eyePartId: eye.partId,
      field: 'parentPartId',
      message:
        `Eye host "${host.partId}" is too shallow for its visible face. ` +
        `It needs at least ${EYE_ANATOMY_POLICY.minimumHostDepthCells} ` +
        'cells of depth and a head-like depth-to-face ratio.'
    });
  }

  if (support?.kind === 'mass' || support?.kind === 'segment') {
    const supportBounds = geometryBounds(support);
    if (supportBounds) {
      const supportSpans = supportBounds.maximum.map(
        (coordinate, axis) => coordinate - supportBounds.minimum[axis]
      );
      const hostVolume = spans.reduce(
        (volume, span) => volume * span,
        1
      );
      const supportVolume = supportSpans.reduce(
        (volume, span) => volume * span,
        1
      );
      const supportMinorSpan = Math.min(...supportSpans);
      if (
        supportVolume *
          EYE_ANATOMY_POLICY.minimumSupportVolumeDenominator <
            hostVolume *
              EYE_ANATOMY_POLICY.minimumSupportVolumeNumerator ||
        supportMinorSpan *
          EYE_ANATOMY_POLICY.maximumHostDepthToSupportMinorSpanRatio <
            depth
      ) {
        issues.push({
          code: 'support-volume',
          eyePartId: eye.partId,
          field: 'parentPartId',
          message:
            `Eye host "${host.partId}" is attached only to a token support ` +
            `volume. Support "${support.partId}" must be a meaningful ` +
            'cranial, body, or display-housing mass, not a tiny anti-audit tab.'
        });
      }
    }
  }

  const requiredPlane = axes.positive
    ? bounds.maximum[axes.normal]
    : bounds.minimum[axes.normal];
  if (eye.anchor[axes.normal] !== requiredPlane) {
    issues.push({
      code: 'surface-plane',
      eyePartId: eye.partId,
      field: 'anchor',
      message:
        `Eye "${eye.partId}" must sit on the outermost ${eye.face} ` +
        `surface plane (${requiredPlane}), not an inset or floating plane.`
    });
  }

  const minimumU = featureMinimum(eye, axes.u, eye.size[0]);
  const minimumV = featureMinimum(eye, axes.v, eye.size[1]);
  const maximumU = minimumU + eye.size[0];
  const maximumV = minimumV + eye.size[1];
  const border = EYE_ANATOMY_POLICY.minimumSurfaceBorderCells;
  if (
    minimumU < bounds.minimum[axes.u] + border ||
    maximumU > bounds.maximum[axes.u] - border ||
    minimumV < bounds.minimum[axes.v] + border ||
    maximumV > bounds.maximum[axes.v] - border
  ) {
    issues.push({
      code: 'surface-border',
      eyePartId: eye.partId,
      field: 'size',
      message:
        `Eye "${eye.partId}" must leave at least ${border} lattice cell ` +
        'of visible host anatomy on every side. Painting the whole face is ' +
        'a mask, not an eye.'
    });
  }

  if (options.requiredFace && eye.face !== options.requiredFace) {
    issues.push({
      code: 'forward-face',
      eyePartId: eye.partId,
      field: 'face',
      message:
        `Eye "${eye.partId}" faces ${eye.face}, but this audited asset ` +
        `declares ${options.requiredFace} as forward.`
    });
  }
  return issues;
};

/**
 * Geometry-based eye audit. It intentionally ignores author-written labels:
 * a compliant eye must be a bounded surface motif on a deep, connected host.
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
