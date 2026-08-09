import type { Vec3 } from '../../model';
import type {
  SurfaceAppearanceAxisRange,
  SurfaceAppearanceMarkingPlan,
  SurfaceAppearanceV1
} from './contract';

const frozenVec3 = (value: Vec3): Vec3 => Object.freeze([
  value[0],
  value[1],
  value[2]
]);

const frozenRange = (
  value: SurfaceAppearanceAxisRange
): SurfaceAppearanceAxisRange => Object.freeze({
  minimum: value.minimum,
  maximum: value.maximum
});

const frozenMarking = (
  value: SurfaceAppearanceMarkingPlan
): SurfaceAppearanceMarkingPlan => Object.freeze({
  id: value.id,
  target: Object.freeze({ ...value.target }),
  region: value.region,
  placement: value.placement,
  motif: value.motif,
  tone: value.tone,
  ...(value.flow === undefined ? {} : { flow: value.flow }),
  ...(value.variant === undefined ? {} : { variant: value.variant }),
  scale: value.scale,
  density: value.density,
  contrast: value.contrast,
  accentColor: value.accentColor,
  maskSeed: value.maskSeed,
  frame: Object.freeze({
    forward: frozenVec3(value.frame.forward),
    left: frozenVec3(value.frame.left),
    up: frozenVec3(value.frame.up),
    lateralRange: frozenRange(value.frame.lateralRange),
    upRange: frozenRange(value.frame.upRange),
    forwardRange: frozenRange(value.frame.forwardRange)
  }),
  rootPoints: Object.freeze(value.rootPoints.map(frozenVec3)),
  reflection: value.reflection === null
    ? null
    : Object.freeze({ ...value.reflection })
});

/** Runtime snapshot matching the readonly Surface Appearance contract. */
export const freezeSurfaceAppearance = (
  value: SurfaceAppearanceV1
): SurfaceAppearanceV1 => Object.freeze({
  version: value.version,
  seed: Object.freeze({ ...value.seed }),
  semanticOwnerKey: value.semanticOwnerKey,
  ...(value.semanticRegion === undefined
    ? {}
    : { semanticRegion: value.semanticRegion }),
  domain: value.domain,
  texture: Object.freeze({ ...value.texture }),
  decoration: value.decoration,
  geometry: value.geometry,
  faceDirection: value.faceDirection,
  faceAspect: value.faceAspect,
  plane: value.plane,
  attachmentPoints: Object.freeze(value.attachmentPoints.map(frozenVec3)),
  protectedRegions: Object.freeze(value.protectedRegions.map((region) =>
    Object.freeze({ ...region })
  )),
  ...(value.markings === undefined ? {} : {
    markings: Object.freeze(value.markings.map(frozenMarking))
  }),
  frame: Object.freeze({
    forward: frozenVec3(value.frame.forward),
    left: frozenVec3(value.frame.left),
    up: frozenVec3(value.frame.up),
    lateralRange: frozenRange(value.frame.lateralRange),
    upRange: frozenRange(value.frame.upRange),
    forwardRange: frozenRange(value.frame.forwardRange)
  }),
  tonePolicy: value.tonePolicy
});
