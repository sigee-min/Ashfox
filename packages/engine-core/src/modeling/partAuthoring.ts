import type {
  LatticeVec3,
  PartAuthoringSpec,
  PartSpec
} from './partContract';
import { partTranslation } from './partPrimitiveAdapter';

const addVec3 = (
  value: LatticeVec3,
  translation: LatticeVec3
): LatticeVec3 => [
  value[0] + translation[0],
  value[1] + translation[1],
  value[2] + translation[2]
];

export const projectSpacePartAuthoringSpec = (
  part: PartSpec
): PartAuthoringSpec => {
  const offset = partTranslation(part);
  const translation: LatticeVec3 = [
    offset.x,
    offset.y,
    offset.z
  ];
  const {
    attachment: _attachment,
    ...authoring
  } = part;
  switch (authoring.kind) {
    case 'mass':
      return {
        ...authoring,
        center: addVec3(authoring.center, translation)
      };
    case 'segment':
      return {
        ...authoring,
        points: authoring.points.map((point) =>
          addVec3(point, translation)
        )
      };
    case 'plate':
      return {
        ...authoring,
        origin: addVec3(authoring.origin, translation)
      };
    case 'radial':
      return {
        ...authoring,
        center: addVec3(authoring.center, translation)
      };
    case 'feature':
      return {
        ...authoring,
        anchor: addVec3(authoring.anchor, translation)
      };
  }
};

const hasOwn = (
  value: object,
  key: PropertyKey
): boolean => Object.prototype.hasOwnProperty.call(value, key);

export const preserveExistingPartAuthoringDefaults = (
  input: PartAuthoringSpec,
  existing: PartSpec | undefined
): PartAuthoringSpec => {
  if (!existing) return input;
  const preserved = {
    ...input,
    ...(!hasOwn(input, 'parentPartId')
      ? { parentPartId: existing.parentPartId }
      : {}),
    ...(!hasOwn(input, 'joint')
      ? { joint: existing.joint }
      : {})
  } as PartAuthoringSpec;

  if (
    (preserved.kind === 'mass' || preserved.kind === 'segment') &&
    !hasOwn(input, 'profile') &&
    (existing.kind === 'mass' || existing.kind === 'segment')
  ) {
    return {
      ...preserved,
      profile: existing.profile
    };
  }
  if (
    preserved.kind === 'radial' &&
    !hasOwn(input, 'innerRadius') &&
    existing.kind === 'radial'
  ) {
    return {
      ...preserved,
      innerRadius: existing.innerRadius
    };
  }
  if (
    preserved.kind === 'feature' &&
    !hasOwn(input, 'relief') &&
    existing.kind === 'feature'
  ) {
    return {
      ...preserved,
      relief: existing.relief
    };
  }
  return preserved;
};
