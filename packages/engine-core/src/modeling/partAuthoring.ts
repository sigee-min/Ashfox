import type {
  LatticeVec2,
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
        ...authoring
      };
  }
};

const hasOwn = (
  value: object,
  key: PropertyKey
): boolean => Object.prototype.hasOwnProperty.call(value, key);

export interface PartAuthoringCompletionIssue {
  path: string;
  message: string;
}

export type PartAuthoringCompletionResult =
  | {
      ok: true;
      value: PartAuthoringSpec;
    }
  | {
      ok: false;
      issue: PartAuthoringCompletionIssue;
    };

const isLatticeVec3 = (
  value: unknown
): value is LatticeVec3 =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((entry) => typeof entry === 'number');

const rectangleOutline = (
  size: LatticeVec2
): readonly LatticeVec2[] => [
  [0, 0],
  [size[0], 0],
  [size[0], size[1]],
  [0, size[1]]
];

/**
 * Completes one public authoring patch into the full project-space shape
 * consumed by the canonical PartSpec normalizer.
 */
export const completePartAuthoringSpec = (
  input: PartAuthoringSpec,
  existing: PartSpec | undefined
): PartAuthoringCompletionResult => {
  const completed = (
    existing?.kind === input.kind
      ? {
          ...projectSpacePartAuthoringSpec(existing),
          ...input
        }
      : { ...input }
  ) as PartAuthoringSpec;

  if (completed.kind === 'segment' && isLatticeVec3(completed.radii)) {
    return {
      ok: true,
      value: {
        ...completed,
        radii: completed.points?.map(() => completed.radii as LatticeVec3)
      }
    };
  }

  if (completed.kind === 'plate') {
    if (hasOwn(input, 'size') && hasOwn(input, 'outline')) {
      return {
        ok: false,
        issue: {
          path: 'size',
          message:
            'Use either size for a rectangle or outline for a custom plate, not both.'
        }
      };
    }
    if (hasOwn(input, 'size') && completed.size !== undefined) {
      const {
        size,
        ...withoutSize
      } = completed;
      return {
        ok: true,
        value: {
          ...withoutSize,
          outline: rectangleOutline(size)
        }
      };
    }
    const {
      size: _size,
      ...withoutSize
    } = completed;
    return { ok: true, value: withoutSize };
  }

  return { ok: true, value: completed };
};
