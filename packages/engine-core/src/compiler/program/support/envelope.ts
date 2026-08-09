import type {
  ModelPartLatticeVec3,
  ModelPartSpec
} from '../../../model';
import { projectSpatialFrame } from '../../../project/frame';
import type {
  IntentProgramDiagnostic,
  IntentProgramSpan
} from '../../../project/program/types';
import { intentProgramDiagnostic } from '../diagnostic';
import type { SupportEmissionPort } from '../lower/context';
import { compilerPartCenter } from '../lower/spatial';

export interface SemanticBounds {
  minimumLateral: number;
  maximumLateral: number;
  minimumUp: number;
  maximumUp: number;
  minimumForward: number;
  maximumForward: number;
  centerLateral: number;
  centerForward: number;
}

interface WorldBounds {
  minimum: ModelPartLatticeVec3;
  maximum: ModelPartLatticeVec3;
}

type MutablePoint = [number, number, number];

export const supportLocalCoordinates = (
  state: SupportEmissionPort,
  point: ModelPartLatticeVec3
): readonly [number, number, number] => {
  const frame = projectSpatialFrame(state.intent);
  const dot = (axis: ModelPartLatticeVec3): number =>
    point[0] * axis[0] + point[1] * axis[1] + point[2] * axis[2];
  return [dot(frame.left), dot(frame.up), dot(frame.forward)];
};

const boundsForPart = (part: ModelPartSpec): WorldBounds | null => {
  if (part.kind === 'feature') return null;
  if (part.kind === 'mass') {
    return {
      minimum: [
        part.center[0] - part.radii[0],
        part.center[1] - part.radii[1],
        part.center[2] - part.radii[2]
      ],
      maximum: [
        part.center[0] + part.radii[0],
        part.center[1] + part.radii[1],
        part.center[2] + part.radii[2]
      ]
    };
  }
  if (part.kind === 'segment') {
    const minimum: MutablePoint = [Infinity, Infinity, Infinity];
    const maximum: MutablePoint = [-Infinity, -Infinity, -Infinity];
    part.points.forEach((point, index) => {
      const radius = part.radii[index]!;
      for (let axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], point[axis] - radius[axis]);
        maximum[axis] = Math.max(maximum[axis], point[axis] + radius[axis]);
      }
    });
    return { minimum, maximum };
  }
  if (part.kind === 'radial') {
    const halfDepth = Math.ceil(part.depth / 2);
    const radii: ModelPartLatticeVec3 = [
      part.axis === 'x' ? halfDepth : part.outerRadius,
      part.axis === 'y' ? halfDepth : part.outerRadius,
      part.axis === 'z' ? halfDepth : part.outerRadius
    ];
    return {
      minimum: [
        part.center[0] - radii[0],
        part.center[1] - radii[1],
        part.center[2] - radii[2]
      ],
      maximum: [
        part.center[0] + radii[0],
        part.center[1] + radii[1],
        part.center[2] + radii[2]
      ]
    };
  }
  const worldPoints = part.outline.map((outlinePoint): ModelPartLatticeVec3 =>
    part.plane === 'xy'
      ? [
          part.origin[0] + outlinePoint[0],
          part.origin[1] + outlinePoint[1],
          part.origin[2]
        ]
      : part.plane === 'xz'
        ? [
            part.origin[0] + outlinePoint[0],
            part.origin[1],
            part.origin[2] + outlinePoint[1]
          ]
        : [
            part.origin[0],
            part.origin[1] + outlinePoint[0],
            part.origin[2] + outlinePoint[1]
          ]
  );
  if (worldPoints.length === 0) return null;
  const minimum: MutablePoint = [Infinity, Infinity, Infinity];
  const maximum: MutablePoint = [-Infinity, -Infinity, -Infinity];
  for (const point of worldPoints) {
    for (let axis = 0; axis < 3; axis += 1) {
      const normalThickness = (
        part.plane === 'xy' && axis === 2 ||
        part.plane === 'xz' && axis === 1 ||
        part.plane === 'yz' && axis === 0
      ) ? part.thickness : 0;
      minimum[axis] = Math.min(minimum[axis], point[axis]);
      maximum[axis] = Math.max(maximum[axis], point[axis] + normalThickness);
    }
  }
  return { minimum, maximum };
};

export const supportSemanticBounds = (state: SupportEmissionPort): SemanticBounds => {
  const ranges = {
    minimumLateral: Infinity,
    maximumLateral: -Infinity,
    minimumUp: Infinity,
    maximumUp: -Infinity,
    minimumForward: Infinity,
    maximumForward: -Infinity
  };
  let totalWeight = 0;
  let weightedLateral = 0;
  let weightedForward = 0;
  for (const part of state.parts) {
    const bounds = boundsForPart(part);
    if (!bounds) continue;
    for (const x of [bounds.minimum[0], bounds.maximum[0]]) {
      for (const y of [bounds.minimum[1], bounds.maximum[1]]) {
        for (const z of [bounds.minimum[2], bounds.maximum[2]]) {
          const [lateral, up, forward] = supportLocalCoordinates(
            state,
            [x, y, z]
          );
          ranges.minimumLateral = Math.min(ranges.minimumLateral, lateral);
          ranges.maximumLateral = Math.max(ranges.maximumLateral, lateral);
          ranges.minimumUp = Math.min(ranges.minimumUp, up);
          ranges.maximumUp = Math.max(ranges.maximumUp, up);
          ranges.minimumForward = Math.min(ranges.minimumForward, forward);
          ranges.maximumForward = Math.max(ranges.maximumForward, forward);
        }
      }
    }
    const [lateral, , forward] = supportLocalCoordinates(
      state,
      compilerPartCenter(part, [0, 0, 0])
    );
    const weight = Math.max(
      1,
      (bounds.maximum[0] - bounds.minimum[0]) *
        (bounds.maximum[1] - bounds.minimum[1]) *
        (bounds.maximum[2] - bounds.minimum[2])
    );
    totalWeight += weight;
    weightedLateral += lateral * weight;
    weightedForward += forward * weight;
  }
  if (totalWeight === 0) {
    return {
      minimumLateral: -4,
      maximumLateral: 4,
      minimumUp: 4,
      maximumUp: 10,
      minimumForward: -4,
      maximumForward: 4,
      centerLateral: 0,
      centerForward: 0
    };
  }
  return {
    ...ranges,
    centerLateral: weightedLateral / totalWeight,
    centerForward: weightedForward / totalWeight
  };
};

const MAX_FOOT_SOLE_FORWARD_RADIUS = 8;
const MAX_BASE_RADIUS = 16;

export const supportFootSoleForwardRadius = (
  state: SupportEmissionPort,
  bounds: SemanticBounds,
  rootForward: number,
  memberForward: number
): number => state.compilation.support.kind === 'feet' &&
  state.compilation.support.moduleIds.length > 1
  ? 1
  : Math.ceil(Math.max(
      Math.abs(bounds.centerForward - memberForward),
      Math.abs(rootForward - memberForward),
      2
    )) + 1;

/** Rejects compiler support growth beyond the closed V1 adaptation budget. */
export const validateSupportEnvelope = (
  state: SupportEmissionPort,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>
): readonly IntentProgramDiagnostic[] => {
  const bounds = supportSemanticBounds(state);
  if (state.compilation.support.kind === 'feet') {
    const rootPart = state.rootPart();
    const rootCenter = rootPart
      ? supportLocalCoordinates(
          state,
          compilerPartCenter(rootPart, [0, 7, 0])
        )
      : [0, 7, 0] as const;
    for (const [index, moduleId] of
      state.compilation.support.moduleIds.entries()) {
      const limb = state.limbPair(moduleId);
      if (!limb) continue;
      for (const member of limb.members) {
        const [, , forward] = supportLocalCoordinates(state, member.endpoint);
        const radius = supportFootSoleForwardRadius(
          state,
          bounds,
          rootCenter[2],
          forward
        );
        if (radius <= MAX_FOOT_SOLE_FORWARD_RADIUS) continue;
        return [intentProgramDiagnostic(
          sourceMap,
          `support.contacts.${index}`,
          'intent-program.support-envelope-exceeded',
          `Foot support "${moduleId}" requires sole radius ${radius}, above the compiler adaptation budget ${MAX_FOOT_SOLE_FORWARD_RADIUS}; add or relocate support modules nearer the body envelope.`
        )];
      }
    }
  }
  if (state.compilation.support.kind === 'base') {
    const baseLateral = Math.round(bounds.centerLateral);
    const baseForward = Math.round(bounds.centerForward);
    const lateralRadius = Math.max(4, Math.ceil(Math.max(
      Math.abs(bounds.minimumLateral - baseLateral),
      Math.abs(bounds.maximumLateral - baseLateral)
    )) + 1);
    const forwardRadius = Math.max(4, Math.ceil(Math.max(
      Math.abs(bounds.minimumForward - baseForward),
      Math.abs(bounds.maximumForward - baseForward)
    )) + 1);
    if (lateralRadius > MAX_BASE_RADIUS || forwardRadius > MAX_BASE_RADIUS) {
      return [intentProgramDiagnostic(
        sourceMap,
        'support.contacts.0',
        'intent-program.support-envelope-exceeded',
        `Base support requires radii ${lateralRadius}×${forwardRadius}, above the compiler adaptation budget ${MAX_BASE_RADIUS}; split or relocate the supported body topology.`
      )];
    }
  }
  return [];
};
