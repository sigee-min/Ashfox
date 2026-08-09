import type { GeometryPartSpec } from '../part';
import type { Cuboid } from '../contract';
import { validBounds } from './operations';
import {
  cuboidFromPlane,
  latticePoint,
  radialPlaneAxes
} from './plane';

export const compileRadial = (
  spec: Extract<GeometryPartSpec, { kind: 'radial' }>
): readonly Cuboid[] => {
  const axes = radialPlaneAxes(spec.axis);
  const center = latticePoint(spec.center);
  const normalMin = center[axes.normal] - Math.floor(spec.depth / 2);
  const normalMax = normalMin + spec.depth;
  const centerU = center[axes.u];
  const centerV = center[axes.v];
  const radius = spec.outerRadius;
  const outerMinU = centerU - radius;
  const outerMaxU = centerU + radius;
  const outerMinV = centerV - radius;
  const outerMaxV = centerV + radius;

  if (spec.innerRadius > 0) {
    const inner = spec.innerRadius;
    const cornerInset = radius > 1 ? 1 : 0;
    return [
      cuboidFromPlane(
        axes, normalMin, normalMax,
        outerMinU + cornerInset, outerMaxU - cornerInset,
        outerMinV, centerV - inner
      ),
      cuboidFromPlane(
        axes, normalMin, normalMax,
        outerMinU, centerU - inner,
        centerV - inner, centerV + inner
      ),
      cuboidFromPlane(
        axes, normalMin, normalMax,
        centerU + inner, outerMaxU,
        centerV - inner, centerV + inner
      ),
      cuboidFromPlane(
        axes, normalMin, normalMax,
        outerMinU + cornerInset, outerMaxU - cornerInset,
        centerV + inner, outerMaxV
      )
    ].filter(({ bounds }) => validBounds(bounds));
  }

  if (radius === 1) {
    return [cuboidFromPlane(
      axes, normalMin, normalMax,
      outerMinU, outerMaxU, outerMinV, outerMaxV
    )];
  }
  const cap = Math.max(1, Math.floor(radius / 2));
  const cornerInset = Math.max(1, Math.floor(radius / 3));
  return [
    cuboidFromPlane(
      axes, normalMin, normalMax,
      outerMinU + cornerInset, outerMaxU - cornerInset,
      outerMinV, outerMinV + cap
    ),
    cuboidFromPlane(
      axes, normalMin, normalMax,
      outerMinU, outerMaxU,
      outerMinV + cap, outerMaxV - cap
    ),
    cuboidFromPlane(
      axes, normalMin, normalMax,
      outerMinU + cornerInset, outerMaxU - cornerInset,
      outerMaxV - cap, outerMaxV
    )
  ].filter(({ bounds }) => validBounds(bounds));
};
