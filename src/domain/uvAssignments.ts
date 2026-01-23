import type { CubeFaceDirection } from './model';
import type { DomainResult } from './result';
import { fail, ok } from './result';

export type UvFaceMap = Partial<Record<CubeFaceDirection, [number, number, number, number]>>;

export type UvAssignmentSpecLike = {
  cubeId?: string;
  cubeName?: string;
  cubeIds?: string[];
  cubeNames?: string[];
  faces: UvFaceMap;
};

export const validateUvAssignments = (
  assignments: UvAssignmentSpecLike[]
): DomainResult<{ valid: true }> => {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return fail('invalid_payload', 'assignments must be a non-empty array');
  }
  for (const assignment of assignments) {
    if (!assignment || typeof assignment !== 'object') {
      return fail('invalid_payload', 'assignment must be an object');
    }
    const hasTarget =
      Boolean(assignment.cubeId) ||
      Boolean(assignment.cubeName) ||
      (Array.isArray(assignment.cubeIds) && assignment.cubeIds.length > 0) ||
      (Array.isArray(assignment.cubeNames) && assignment.cubeNames.length > 0);
    if (!hasTarget) {
      return fail('invalid_payload', 'assignment must include cubeId/cubeName or cubeIds/cubeNames');
    }
    if (assignment.cubeIds && !assignment.cubeIds.every((id: unknown) => typeof id === 'string')) {
      return fail('invalid_payload', 'cubeIds must be an array of strings');
    }
    if (assignment.cubeNames && !assignment.cubeNames.every((name: unknown) => typeof name === 'string')) {
      return fail('invalid_payload', 'cubeNames must be an array of strings');
    }
    if (!assignment.faces || typeof assignment.faces !== 'object') {
      return fail('invalid_payload', 'faces is required for each assignment');
    }
    const faceEntries = Object.entries(assignment.faces);
    if (faceEntries.length === 0) {
      return fail('invalid_payload', 'faces must include at least one mapping');
    }
    for (const [faceKey, uv] of faceEntries) {
      if (!VALID_FACES.has(faceKey as CubeFaceDirection)) {
        return fail('invalid_payload', `invalid face: ${faceKey}`);
      }
      if (!Array.isArray(uv) || uv.length !== 4) {
        return fail('invalid_payload', `UV for ${faceKey} must be [x1,y1,x2,y2]`);
      }
      if (!uv.every((value) => Number.isFinite(value))) {
        return fail('invalid_payload', `UV for ${faceKey} must contain finite numbers`);
      }
    }
  }
  return ok({ valid: true });
};

const VALID_FACES = new Set<CubeFaceDirection>(['north', 'south', 'east', 'west', 'up', 'down']);
