import type { ProjectIntent } from '../../model';
import { projectSpatialFrame } from '../../project/frame';
import {
  eyeGlyphPixelRole,
  type EyePupilBias
} from './glyph';
import { cellKey } from '../lattice';
import type { EyeFeaturePartSpec } from '../part';
import {
  surfaceFeatureAxes,
  surfaceFeaturePixels,
  type SurfaceFeaturePixel
} from '../surface/feature';
import type { Axis, CellKey } from '../contract';

const axisCoordinate = (
  value: Readonly<{ x: number; y: number; z: number }>,
  axis: Axis
): number => value[axis];

/**
 * Derives centered gaze from the project frame. No per-eye offset is stored:
 * odd widths use the exact center, while even paired eyes choose the inner
 * center column.
 */
export const centeredEyePupilBias = (
  intent: Pick<ProjectIntent, 'forward' | 'symmetry'>,
  eye: EyeFeaturePartSpec
): EyePupilBias => {
  if (eye.size[0] % 2 === 1) {
    return 0;
  }
  const frame = projectSpatialFrame(intent);
  if (frame.planeTwice === null) return 0;
  const axes = surfaceFeatureAxes(eye.face);
  if (axes.u !== frame.lateralAxis) return 0;
  const pixels = surfaceFeaturePixels(eye);
  const coordinates = pixels.map((pixel) =>
    axisCoordinate(pixel.boundaryCell, axes.u)
  );
  const minimum = Math.min(...coordinates);
  const maximum = Math.max(...coordinates);
  const centerTwice = minimum + maximum + 1;
  const worldDirection = Math.sign(frame.planeTwice - centerTwice);
  if (worldDirection === 0) return 0;
  const localOrientation = eye.face === 'north' || eye.face === 'east'
    ? -1
    : 1;
  return (worldDirection * localOrientation) as EyePupilBias;
};

const localCoordinates = (
  eye: EyeFeaturePartSpec,
  pixel: SurfaceFeaturePixel
): readonly [number, number] => {
  const axes = surfaceFeatureAxes(eye.face);
  const u = axisCoordinate(pixel.boundaryCell, axes.u);
  const v = axisCoordinate(pixel.boundaryCell, axes.v);
  const minU = eye.anchor[axes.u === 'x' ? 0 : axes.u === 'y' ? 1 : 2] -
    Math.floor(eye.size[0] / 2);
  const minV = eye.anchor[axes.v === 'x' ? 0 : axes.v === 'y' ? 1 : 2] -
    Math.floor(eye.size[1] / 2);
  const maxU = minU + eye.size[0];
  const maxV = minV + eye.size[1];
  const x = eye.face === 'north' || eye.face === 'east'
    ? maxU - u - 1
    : u - minU;
  const y = eye.face === 'up'
    ? v - minV
    : maxV - v - 1;
  return [x, y];
};

export const eyePupilCells = (
  intent: Pick<ProjectIntent, 'forward' | 'symmetry'>,
  eye: EyeFeaturePartSpec
): ReadonlySet<CellKey> => {
  const bias = centeredEyePupilBias(intent, eye);
  const cells = new Set<CellKey>();
  for (const pixel of surfaceFeaturePixels(eye)) {
    const [x, y] = localCoordinates(eye, pixel);
    if (eyeGlyphPixelRole(
      eye.glyph,
      x,
      y,
      eye.size[0],
      eye.size[1],
      bias
    ) === 'pupil') {
      cells.add(cellKey(pixel.boundaryCell));
    }
  }
  return cells;
};
