import type {
  AuthoringFaceComponentDeclaration,
  AuthoringFaceContract,
  AuthoringFaceException
} from '../../authoring/authoringTypes';
import type {
  ModelPartLatticeVec3
} from '../../model';
import {
  projectSpatialFrame,
  reflectProjectPoint
} from '../../project/projectSpatialFrame';
import {
  reflectedPrimitive,
  translatePrimitive
} from '../../modeling/partRecipeTransforms/geometry';
import type { IntentProgramIr } from '../../project/intentProgramTypes';
import {
  addGraph,
  addSlot,
  attachment,
  centeredOrAsymmetric,
  compilerHostAnchor,
  compilerPartPlanarReach,
  faceByForward,
  localPoint,
  localRadii,
  sideRelation,
  sideSymmetry,
  type BuildState,
  type IntentProgramModuleHost
} from './state';
import { placeFaceHost } from './facePlacement';
import { addSurfaceMembers } from './surfaceMemberLowering';

const addPoints = (
  ...points: readonly ModelPartLatticeVec3[]
): ModelPartLatticeVec3 => points.reduce<ModelPartLatticeVec3>(
  (total, point) => [
    total[0] + point[0],
    total[1] + point[1],
    total[2] + point[2]
  ],
  [0, 0, 0]
);

const reflectPairedSurface = (
  state: BuildState,
  surfaceId: string,
  surfaceStart: number,
  frame: ReturnType<typeof projectSpatialFrame>
): void => {
  const leftPrefix = `surface.${surfaceId}.left.`;
  const rightPrefix = `surface.${surfaceId}.right.`;
  const leftParts = new Map(state.parts
    .slice(surfaceStart)
    .filter((part) => part.partId.startsWith(leftPrefix))
    .map((part) => [part.partId, part] as const));
  for (let index = surfaceStart; index < state.parts.length; index += 1) {
    const existing = state.parts[index]!;
    if (!existing.partId.startsWith(rightPrefix)) continue;
    const source = leftParts.get(
      `${leftPrefix}${existing.partId.slice(rightPrefix.length)}`
    );
    if (!source || source.kind === 'feature') continue;
    const reflected = translatePrimitive(
      reflectedPrimitive(source, frame.lateralAxis),
      frame.lateralAxis === 'x'
        ? [frame.planeTwice ?? 0, 0, 0]
        : [0, 0, frame.planeTwice ?? 0]
    );
    if (reflected.kind === 'feature') continue;
    const mirroredId = existing.partId;
    state.parts[index] = {
      ...reflected,
      partId: mirroredId,
      parentPartId: source.parentPartId?.startsWith(leftPrefix)
        ? `${rightPrefix}${source.parentPartId.slice(leftPrefix.length)}`
        : source.parentPartId,
      attachment: source.attachment === null ? null : {
        parentAnchor: reflectProjectPoint(source.attachment.parentAnchor, frame),
        partAnchor: reflectProjectPoint(source.attachment.partAnchor, frame)
      }
    };
  }
};

export const addSurface = (
  state: BuildState,
  surface: IntentProgramIr['surfaces'][number],
  rootPartId: string,
  rootSlotId: string
): void => {
  const surfaceStart = state.parts.length;
  const frame = projectSpatialFrame(state.intent);
  const host = state.parts.find((part) => part.partId === rootPartId);
  addSurfaceMembers({
    state,
    surface,
    rootPartId,
    rootSlotId,
    frame,
    hostOrigin: compilerHostAnchor(
      state.intent,
      host,
      localPoint(state.intent, 0, 5, 0)
    ),
    hostReach: compilerPartPlanarReach(host),
    radialHost: host?.kind === 'radial'
  });
  if (surface.configuration === 'paired') {
    reflectPairedSurface(state, surface.id, surfaceStart, frame);
    const leftPrefix = `surface.${surface.id}.left.`;
    const rightPrefix = `surface.${surface.id}.right.`;
    for (const part of state.parts.slice(surfaceStart)) {
      if (!part.partId.startsWith(leftPrefix) || part.kind === 'feature') {
        continue;
      }
      const reflectedPartId =
        `${rightPrefix}${part.partId.slice(leftPrefix.length)}`;
      if (state.parts.some((candidate) =>
        candidate.partId === reflectedPartId && candidate.kind !== 'feature'
      )) {
        state.attachmentReflections.push({
          sourcePartId: part.partId,
          reflectedPartId
        });
      }
    }
  }
  addGraph(state, {
    id: `surface.${surface.id}`, kind: 'surface', sourcePath: `surfaces.${surface.id}`,
    parentId: surface.from, configuration: surface.configuration
  });
};

const faceException = (
  component: 'nasal' | 'oral'
): { component: 'nasal' | 'oral'; basis: 'requested'; referenceIds: readonly string[]; rationale: string } => ({
  component, basis: 'requested', referenceIds: ['intent.subject'],
  rationale: `The confirmed Intent Program explicitly omits ${component}.`
});

export const addFace = (
  state: BuildState,
  host: IntentProgramModuleHost
): AuthoringFaceContract | null => {
  if (state.program.face.kind === 'none') return null;
  const placement = placeFaceHost(state, host);
  const faceCenter = placement.center;
  const faceAttachment = placement.attachment;
  const faceParent = placement.parent;
  const hostPartId = 'face.host';
  const hostSlotId = 'slot.face.host';
  state.parts.push({
    partId: hostPartId, parentPartId: faceParent.partId, materialId: 'mat.base', joint: { kind: 'fixed' },
    attachment: attachment(faceAttachment), kind: 'mass',
    center: faceCenter, radii: localRadii(state.intent, 6, 5, 2), profile: 'balanced'
  });
  addSlot(state, {
    slotId: hostSlotId, structuralRole: 'focal-frame', qualityStage: 'structure', partIds: [hostPartId],
    parentSlotIds: [faceParent.slotId], spatialRelations: ['front'], facing: 'forward',
    symmetry: centeredOrAsymmetric(state.program), support: { kind: 'none' }, span: { kind: 'none' }
  });
  addGraph(state, {
    id: 'face.host', kind: 'face-host', sourcePath: 'face',
    parentId: faceParent.moduleId,
    configuration: 'single'
  });
  const face = faceByForward[state.intent.forward];
  const frame = projectSpatialFrame(state.intent);
  const components: AuthoringFaceComponentDeclaration[] = [];
  const exceptions: AuthoringFaceException[] = [];
  const eyeFrameSlotId = state.program.track === 'hero'
    ? 'slot.face.eye-frame'
    : hostSlotId;
  const eyeFramePartId = state.program.track === 'hero'
    ? 'face.orbital'
    : hostPartId;
  if (state.program.track === 'hero') {
    state.parts.push({
      partId: eyeFramePartId, parentPartId: hostPartId, materialId: 'mat.dark',
      joint: { kind: 'fixed' }, attachment: attachment(addPoints(faceCenter, localPoint(state.intent, 0, 0, 2))),
      kind: 'mass', center: addPoints(faceCenter, localPoint(state.intent, 0, 0, 2)), radii: localRadii(state.intent, 4, 5, 1), profile: 'hard'
    });
    addSlot(state, {
      slotId: eyeFrameSlotId, structuralRole: 'focal-frame', qualityStage: 'focal',
      partIds: [eyeFramePartId], parentSlotIds: [hostSlotId], spatialRelations: ['front'],
      facing: 'forward', symmetry: centeredOrAsymmetric(state.program),
      support: { kind: 'none' }, span: { kind: 'none' }
    });
    components.push({
      component: 'eye-frame', form: 'orbital', slotIds: [eyeFrameSlotId], materialIds: ['mat.dark']
    });
  }
  const focalSurfacePartId = state.program.track === 'hero'
    ? eyeFramePartId
    : hostPartId;
  const focalSurfaceSlotId = state.program.track === 'hero'
    ? eyeFrameSlotId
    : hostSlotId;
  const focalSurfaceDepth = state.program.track === 'hero' ? 3 : 2;
  const eyeSlots = state.program.face.eyes === 'single'
    ? ['slot.face.eye.center']
    : ['slot.face.eye.left', 'slot.face.eye.right'];
  for (const slotId of eyeSlots) {
    const side = slotId.endsWith('.left') ? 'left' : slotId.endsWith('.right') ? 'right' : null;
    const partId = side ? `face.eye.${side}` : 'face.eye.center';
    const eyeLateral = side === null
      ? 0
      : frame.lateralSign === 1
        ? side === 'left' ? 2 : -1
        : side === 'left' ? 1 : -2;
    state.parts.push({
      partId, parentPartId: focalSurfacePartId, materialId: 'mat.eye', joint: { kind: 'fixed' }, attachment: null,
      kind: 'feature', motif: 'eye', glyph: 'square', face,
      anchor: addPoints(faceCenter, localPoint(
        state.intent,
        eyeLateral,
        0,
        focalSurfaceDepth
      )),
      // A bilateral project is reflected across a lattice vertex. A centered
      // single feature must therefore have an even footprint: its two middle
      // texels straddle the mirror plane and its derived pupil set reflects
      // exactly onto itself. Odd footprints are centered on a cell instead.
      size: side === null && state.program.symmetry === 'bilateral'
        ? [4, 3]
        : [3, 3]
    });
    addSlot(state, {
      slotId, structuralRole: 'focal-frame', qualityStage: 'focal', partIds: [partId],
      parentSlotIds: [focalSurfaceSlotId], spatialRelations: side ? sideRelation(side) : [], facing: 'forward',
      symmetry: side ? sideSymmetry('pair.face.eyes') : centeredOrAsymmetric(state.program),
      support: { kind: 'none' }, span: { kind: 'none' }
    });
    addGraph(state, {
      id: partId, kind: 'face-feature', sourcePath: 'face.eyes', parentId: 'face.host',
      configuration: side ? 'paired' : 'single'
    });
  }
  components.push({
    component: 'eye', form: 'eye',
    configuration: eyeSlots.length === 1
      ? { kind: 'single', slotId: eyeSlots[0] }
      : { kind: 'paired', leftSlotId: eyeSlots[0], rightSlotId: eyeSlots[1] },
    gaze: 'centered', palette: 'high-contrast', materialIds: ['mat.eye']
  });
  const nasalPresent = state.program.face.nose !== 'absent';
  if (nasalPresent) {
    const slotId = 'slot.face.nasal';
    const partId = 'face.nasal';
    state.parts.push({
      partId, parentPartId: focalSurfacePartId, materialId: 'mat.accent', joint: { kind: 'fixed' }, attachment: null,
      kind: 'feature', motif: 'nose', glyph: 'dot', face,
      anchor: addPoints(faceCenter, localPoint(state.intent, 0, -3, focalSurfaceDepth)), size: [2, 1]
    });
    addSlot(state, {
      slotId, structuralRole: 'focal-frame', qualityStage: 'focal', partIds: [partId],
      parentSlotIds: [focalSurfaceSlotId], spatialRelations: ['front'], facing: 'forward',
      symmetry: centeredOrAsymmetric(state.program), support: { kind: 'none' }, span: { kind: 'none' }
    });
    components.push({ component: 'nasal', form: 'nose', slotIds: [slotId], materialIds: ['mat.accent'] });
  } else exceptions.push(faceException('nasal'));
  const oralPresent = state.program.face.mouth !== 'absent';
  if (oralPresent) {
    const slotId = 'slot.face.oral';
    const partId = 'face.oral';
    const mouth = state.program.face.mouth;
    const oralUp = -4;
    const oralSize: readonly [number, number] = mouth === 'beak'
      ? [4, 2]
      : mouth === 'fang' ? [2, 2] : [2, 1];
    state.parts.push({
      partId, parentPartId: focalSurfacePartId, materialId: 'mat.dark', joint: { kind: 'fixed' }, attachment: null,
      kind: 'feature', motif: 'mouth', glyph: mouth === 'beak' ? 'beak' : mouth === 'fang' ? 'fang' : 'neutral',
      face, anchor: addPoints(faceCenter, localPoint(state.intent, 0, oralUp, focalSurfaceDepth)), size: oralSize
    });
    addSlot(state, {
      slotId, structuralRole: 'focal-frame', qualityStage: 'focal', partIds: [partId],
      parentSlotIds: [focalSurfaceSlotId], spatialRelations: ['front'], facing: 'forward',
      symmetry: centeredOrAsymmetric(state.program), support: { kind: 'none' }, span: { kind: 'none' }
    });
    components.push({
      component: 'oral', form: mouth === 'beak' ? 'beak' : 'mouth', slotIds: [slotId], materialIds: ['mat.dark']
    });
  } else exceptions.push(faceException('oral'));
  if (state.program.track === 'hero' && oralPresent) {
    const slotId = 'slot.face.jaw';
    const partId = 'face.jaw';
    state.parts.push({
      partId,
      parentPartId: hostPartId,
      materialId: 'mat.base',
      joint: { kind: 'fixed' },
      attachment: attachment(addPoints(faceCenter, localPoint(state.intent, 0, -5, 0))),
      kind: 'mass',
      center: addPoints(faceCenter, localPoint(state.intent, 0, -6, 0)),
      radii: localRadii(state.intent, 2, 1, 1),
      profile: 'hard'
    });
    addSlot(state, {
      slotId,
      structuralRole: 'focal-frame',
      qualityStage: 'focal',
      partIds: [partId],
      parentSlotIds: [hostSlotId],
      spatialRelations: ['below'],
      facing: null,
      symmetry: centeredOrAsymmetric(state.program),
      support: { kind: 'none' },
      span: { kind: 'none' }
    });
    components.push({
      component: 'jaw',
      form: 'jaw',
      slotIds: [slotId],
      materialIds: ['mat.base']
    });
  }
  return {
    hostSlotId, mouthState: oralPresent
      ? state.program.face.mouth === 'beak' ? 'beak' : 'closed'
      : 'absent',
    components, exceptions
  };
};
