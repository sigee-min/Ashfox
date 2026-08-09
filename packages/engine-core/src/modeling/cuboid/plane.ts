import type { LatticeVec3, PlatePartSpec } from '../part';
import type { Axis, Cuboid, LatticePoint } from '../contract';

export type PlaneAxes = Readonly<{
  normal: Axis;
  u: Axis;
  v: Axis;
}>;

export const latticePoint = (value: LatticeVec3): LatticePoint => ({
  x: value[0],
  y: value[1],
  z: value[2]
});

export const planeAxes = (plane: PlatePartSpec['plane']): PlaneAxes => {
  if (plane === 'xy') return { normal: 'z', u: 'x', v: 'y' };
  if (plane === 'xz') return { normal: 'y', u: 'x', v: 'z' };
  return { normal: 'x', u: 'y', v: 'z' };
};

export const radialPlaneAxes = (normal: Axis): PlaneAxes => {
  if (normal === 'x') return { normal, u: 'y', v: 'z' };
  if (normal === 'y') return { normal, u: 'x', v: 'z' };
  return { normal, u: 'x', v: 'y' };
};

export const cuboidFromPlane = (
  axes: PlaneAxes,
  normalMin: number,
  normalMax: number,
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number
): Cuboid => {
  const min = { x: 0, y: 0, z: 0 };
  const max = { x: 0, y: 0, z: 0 };
  min[axes.normal] = normalMin;
  max[axes.normal] = normalMax;
  min[axes.u] = uMin;
  max[axes.u] = uMax;
  min[axes.v] = vMin;
  max[axes.v] = vMax;
  return { bounds: { min, max } };
};
