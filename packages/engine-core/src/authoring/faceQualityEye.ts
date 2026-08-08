import type { ProjectDocument } from '../model';
import { eyePupilCells } from '../modeling/eyeGaze';
import { cellKey } from '../modeling/lattice';
import type { EyeFeaturePartSpec } from '../modeling/partContract';
import {
  areLatticeCellSetsExactReflections
} from '../modeling/partRecipeTransforms/geometry';
import { surfaceFeaturePixels } from '../modeling/surfaceFeature';
import { projectSpatialFrame } from '../project/projectSpatialFrame';
import { authoringPlanIssue } from './authoringIssueFactories';
import type {
  AuthoringPlanIssue,
  AuthoringSlotStatus
} from './authoringPlanTypes';
import type {
  ArchetypeReference,
  AuthoringEyeFaceComponentDeclaration
} from './authoringTypes';

interface FaceEyeSpatialQuality {
  ready: boolean;
  issue: AuthoringPlanIssue | null;
}

const featureFootprint = (
  eye: EyeFeaturePartSpec
): ReadonlySet<`${number},${number},${number}`> => new Set(
  surfaceFeaturePixels(eye).map((pixel) => cellKey(pixel.boundaryCell))
);

export const evaluateFaceEyeSpatialQuality = (
  document: ProjectDocument,
  authority: ArchetypeReference,
  declaration: AuthoringEyeFaceComponentDeclaration,
  readableEyes: readonly EyeFeaturePartSpec[],
  expectedEyeCount: number,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>
): FaceEyeSpatialQuality => {
  if (readableEyes.length !== expectedEyeCount || !document.intent) {
    return { ready: true, issue: null };
  }
  const directionReady = readableEyes.every(
    (eye) => eye.face === document.intent?.forward
  );
  const paletteReady = declaration.materialIds.length === 1 &&
    readableEyes.every(
      (eye) => eye.materialId === declaration.materialIds[0]
    );
  let footprintReady = true;
  let pupilReady = true;
  if (declaration.configuration.kind === 'paired') {
    if (document.intent.symmetry.kind !== 'bilateral') {
      footprintReady = false;
      pupilReady = false;
    } else {
      const frame = projectSpatialFrame(document.intent);
      const leftSlot = slotsById.get(
        declaration.configuration.leftSlotId
      );
      const rightSlot = slotsById.get(
        declaration.configuration.rightSlotId
      );
      const leftEye = readableEyes.find((eye) =>
        leftSlot?.partIds.includes(eye.partId)
      );
      const rightEye = readableEyes.find((eye) =>
        rightSlot?.partIds.includes(eye.partId)
      );
      footprintReady = Boolean(leftEye && rightEye) &&
        areLatticeCellSetsExactReflections(
          featureFootprint(leftEye as EyeFeaturePartSpec),
          featureFootprint(rightEye as EyeFeaturePartSpec),
          frame.lateralAxis,
          frame.plane as number
        );
      pupilReady = Boolean(leftEye && rightEye) &&
        areLatticeCellSetsExactReflections(
          eyePupilCells(document.intent, leftEye as EyeFeaturePartSpec),
          eyePupilCells(document.intent, rightEye as EyeFeaturePartSpec),
          frame.lateralAxis,
          frame.plane as number
        );
    }
  } else if (document.intent.symmetry.kind === 'bilateral') {
    const frame = projectSpatialFrame(document.intent);
    const eye = readableEyes[0] as EyeFeaturePartSpec;
    footprintReady = areLatticeCellSetsExactReflections(
      featureFootprint(eye),
      featureFootprint(eye),
      frame.lateralAxis,
      frame.plane as number
    );
    const pupils = eyePupilCells(document.intent, eye);
    pupilReady = areLatticeCellSetsExactReflections(
      pupils,
      pupils,
      frame.lateralAxis,
      frame.plane as number
    );
  }
  const ready = directionReady &&
    paletteReady &&
    footprintReady &&
    pupilReady;
  if (ready) return { ready, issue: null };
  return {
    ready,
    issue: authoringPlanIssue(
      'authoring.plan.face_eye_gaze_invalid',
      'authoringProfile.face.components.eye',
      'Eye footprints, pupil texels, forward face, or contrast palette violate the centered gaze contract.',
      'forward-facing 3x3+ eyes with exact reflected footprints and compiler-derived centered pupils using one declared iris material',
      {
        authority,
        partIds: readableEyes.map((eye) => eye.partId)
      }
    )
  };
};
