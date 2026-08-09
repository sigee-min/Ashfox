import type {
  GeneratedPartJoint,
  ProjectDocument,
  Vec3
} from '../../model';
import type { CompiledPartState } from '../../modeling/invariants';
import { worldToLattice } from '../../modeling/lattice';
import {
  reflectProjectPoint,
  type ProjectSpatialFrame
} from '../../project/frame';

export interface AuthoringRigEntry {
  pivot: Vec3;
  joint: string;
}

/** Hinge axes are unoriented lines, so reflection preserves the axis name. */
export const authoringJointSignature = (
  joint: GeneratedPartJoint
): string => joint.kind === 'hinge'
  ? `hinge:${joint.axis}`
  : joint.kind;

export const compiledPartRigEntry = (
  part: CompiledPartState,
  document: ProjectDocument
): AuthoringRigEntry => ({
  pivot: [
    worldToLattice(
      part.bone.transform.pivot[0],
      document.settings.surfacePixelDensity
    ),
    worldToLattice(
      part.bone.transform.pivot[1],
      document.settings.surfacePixelDensity
    ),
    worldToLattice(
      part.bone.transform.pivot[2],
      document.settings.surfacePixelDensity
    )
  ],
  joint: authoringJointSignature(part.joint)
});

const rigSignature = (
  entries: readonly AuthoringRigEntry[]
): readonly string[] => entries.map((entry) =>
  `${entry.pivot.join(',')}|${entry.joint}`
).sort((left, right) => left.localeCompare(right));

export const exactAuthoringRigReflection = (
  source: readonly AuthoringRigEntry[],
  target: readonly AuthoringRigEntry[],
  frame: ProjectSpatialFrame
): boolean => source.length === target.length &&
  JSON.stringify(rigSignature(source.map((entry) => ({
    ...entry,
    pivot: reflectProjectPoint(entry.pivot, frame)
  })))) === JSON.stringify(rigSignature(target));

export const exactCompiledPartRigReflection = (
  source: CompiledPartState,
  target: CompiledPartState,
  document: ProjectDocument,
  frame: ProjectSpatialFrame
): boolean => {
  // Fixed geometry has no animatable local relationship. Its canonical
  // occupancy is checked separately; using attachment pivots here would
  // incorrectly reject a thickness-one plate whose cell reflection is offset
  // by one lattice unit from its vertex origin.
  if (source.joint.kind === 'fixed' && target.joint.kind === 'fixed') {
    return true;
  }
  return exactAuthoringRigReflection(
    [compiledPartRigEntry(source, document)],
    [compiledPartRigEntry(target, document)],
    frame
  );
};
