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

const lateralSide = (
  slot: AuthoringSlotStatus
): 'left' | 'right' | null => {
  const left = slot.spatialRelations.includes('left');
  const right = slot.spatialRelations.includes('right');
  return left === right ? null : left ? 'left' : 'right';
};

const semanticParentSlotsReflect = (
  left: AuthoringSlotStatus,
  right: AuthoringSlotStatus
): boolean => {
  if (left.slotId === right.slotId) {
    return left.symmetry?.kind === 'centered';
  }
  return left.symmetry?.kind === 'paired' &&
    right.symmetry?.kind === 'paired' &&
    left.symmetry.pairId === right.symmetry.pairId &&
    lateralSide(left) === 'left' &&
    lateralSide(right) === 'right';
};

interface EyeSurfaceBinding {
  eye: EyeFeaturePartSpec;
  eyeSlot: AuthoringSlotStatus;
  surfaceHost: AuthoringSlotStatus;
}

const eyeSurfaceBinding = (
  eye: EyeFeaturePartSpec | undefined,
  eyeSlot: AuthoringSlotStatus | undefined,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>,
  permittedSurfaceHostSlotIds: ReadonlySet<string>
): EyeSurfaceBinding | null => {
  if (!eye || !eyeSlot || eyeSlot.parentSlotIds.length !== 1) return null;
  const surfaceHostId = eyeSlot.parentSlotIds[0] as string;
  if (!permittedSurfaceHostSlotIds.has(surfaceHostId)) return null;
  const surfaceHost = slotsById.get(surfaceHostId);
  if (
    !surfaceHost ||
    surfaceHost.partIds.length !== 1 ||
    surfaceHost.presentPartIds.length !== 1 ||
    surfaceHost.partIds[0] !== surfaceHost.presentPartIds[0] ||
    eye.parentPartId === null ||
    eye.parentPartId !== surfaceHost.presentPartIds[0]
  ) {
    return null;
  }
  return { eye, eyeSlot, surfaceHost };
};

export const evaluateFaceEyeSpatialQuality = (
  document: ProjectDocument,
  authority: ArchetypeReference,
  declaration: AuthoringEyeFaceComponentDeclaration,
  readableEyes: readonly EyeFeaturePartSpec[],
  expectedEyeCount: number,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>,
  permittedSurfaceHostSlotIds: ReadonlySet<string>
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
  let parentSurfaceReady = true;
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
      const leftBinding = eyeSurfaceBinding(
        leftEye,
        leftSlot,
        slotsById,
        permittedSurfaceHostSlotIds
      );
      const rightBinding = eyeSurfaceBinding(
        rightEye,
        rightSlot,
        slotsById,
        permittedSurfaceHostSlotIds
      );
      parentSurfaceReady = leftBinding !== null &&
        rightBinding !== null &&
        semanticParentSlotsReflect(
          leftBinding.surfaceHost,
          rightBinding.surfaceHost
        ) &&
        leftEye?.face === rightEye?.face;
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
    const eyeSlot = slotsById.get(declaration.configuration.slotId);
    const binding = eyeSurfaceBinding(
      eye,
      eyeSlot,
      slotsById,
      permittedSurfaceHostSlotIds
    );
    parentSurfaceReady = binding?.surfaceHost.symmetry?.kind === 'centered';
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
  } else {
    const eye = readableEyes[0] as EyeFeaturePartSpec;
    parentSurfaceReady = eyeSurfaceBinding(
      eye,
      slotsById.get(declaration.configuration.slotId),
      slotsById,
      permittedSurfaceHostSlotIds
    ) !== null;
  }
  const ready = directionReady &&
    paletteReady &&
    footprintReady &&
    pupilReady &&
    parentSurfaceReady;
  if (ready) return { ready, issue: null };
  return {
    ready,
    issue: authoringPlanIssue(
      'authoring.plan.face_eye_gaze_invalid',
      'authoringProfile.face.components.eye',
      'Eye parent surfaces, footprints, pupil texels, forward face, or contrast palette violate the centered gaze contract.',
      'eyes directly parented to actual parts of the declared face host or reflected eye-frame hosts, with forward-facing exact reflected footprints and compiler-derived centered pupils using one declared iris material',
      {
        authority,
        partIds: readableEyes.map((eye) => eye.partId)
      }
    )
  };
};
