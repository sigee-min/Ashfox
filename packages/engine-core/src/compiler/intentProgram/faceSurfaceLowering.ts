import type {
  AuthoringFaceComponentDeclaration,
  AuthoringFaceContract,
  AuthoringFaceException,
  AuthoringSlotAssignment
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
  type IntentProgramModuleHost,
  type Side
} from './state';
import { placeFaceHost } from './facePlacement';

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

const scalePoint = (
  point: ModelPartLatticeVec3,
  amount: number
): ModelPartLatticeVec3 => [
  point[0] * amount,
  point[1] * amount,
  point[2] * amount
];

const vectorAxis = (
  point: ModelPartLatticeVec3
): 'x' | 'y' | 'z' => point[0] !== 0 ? 'x' : point[1] !== 0 ? 'y' : 'z';

const planeFor = (
  first: ModelPartLatticeVec3,
  second: ModelPartLatticeVec3
): 'xy' | 'xz' | 'yz' => {
  const axes = new Set([vectorAxis(first), vectorAxis(second)]);
  if (axes.has('x') && axes.has('y')) return 'xy';
  if (axes.has('x') && axes.has('z')) return 'xz';
  return 'yz';
};

const planeAxes = (
  plane: 'xy' | 'xz' | 'yz'
): readonly ['x' | 'y' | 'z', 'x' | 'y' | 'z'] =>
  plane === 'xy' ? ['x', 'y'] : plane === 'xz' ? ['x', 'z'] : ['y', 'z'];

const axisValue = (
  point: ModelPartLatticeVec3,
  axis: 'x' | 'y' | 'z'
): number => point[axis === 'x' ? 0 : axis === 'y' ? 1 : 2];

const plateOutlineThrough = (
  plane: 'xy' | 'xz' | 'yz',
  origin: ModelPartLatticeVec3,
  vertices: readonly ModelPartLatticeVec3[]
): readonly [number, number][] => {
  const [u, v] = planeAxes(plane);
  return vertices.map((vertex) => [
    axisValue(vertex, u) - axisValue(origin, u),
    axisValue(vertex, v) - axisValue(origin, v)
  ]);
};

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
  const hostOrigin = compilerHostAnchor(
    state.intent,
    host,
    localPoint(state.intent, 0, 5, 0)
  );
  const hostReach = compilerPartPlanarReach(host);
  // A supported surface is a structural semantic unit in its own right,
  // even when its host is the silhouette-stage root core.
  const qualityStage = 'structure' as const;
  const sides: readonly (Side | null)[] = surface.configuration === 'paired'
    ? ['left', 'right'] : [null];
  const pairId = `pair.surface.${surface.id}`;
  const pairedNonLateral =
    surface.configuration === 'paired' && surface.extension !== 'lateral';
  const segmentRadius: ModelPartLatticeVec3 = [1, 1, 1];
  for (const side of sides) {
    const member = side ?? 'center';
    const slotId = `slot.surface.${surface.id}.${member}`;
    const rootIds = [`surface.${surface.id}.${member}.root`];
    const sparIds = [
      `surface.${surface.id}.${member}.spar.1`,
      `surface.${surface.id}.${member}.spar.2`
    ];
    const membranePartIds = [`surface.${surface.id}.${member}.membrane`];
    const sideVector = side === 'right' ? frame.right : frame.left;
    const extension = surface.extension === 'lateral'
      ? sideVector
      : surface.extension === 'up'
        ? frame.up
        : surface.extension === 'forward'
          ? frame.forward
          : scalePoint(frame.forward, -1);
    const cross = surface.extension === 'lateral'
      ? frame.up
      : surface.extension === 'up'
        ? side === null ? frame.left : frame.forward
        : surface.configuration === 'paired' ? frame.up : frame.left;
    const mountBase = addPoints(
      hostOrigin,
      side !== null && surface.extension !== 'lateral'
        ? scalePoint(sideVector, Math.max(1, hostReach - 1))
        : [0, 0, 0]
    );
    // Lateral surfaces mount above articulated lower-body modules. This keeps
    // their root and spar seam ownership disjoint from neutral feet and limbs.
    const base = addPoints(
      mountBase,
      surface.extension === 'lateral' ? scalePoint(frame.up, 2) : [0, 0, 0]
    );
    const rootExtensionStart =
      host?.kind === 'radial' && surface.extension === 'up' ? 0 : hostReach;
    const plane = planeFor(extension, cross);
    const rootStart = addPoints(
      base,
      scalePoint(extension, rootExtensionStart)
    );
    const rootEnd = addPoints(
      base,
      scalePoint(extension, rootExtensionStart + 1)
    );
    state.parts.push({
      partId: rootIds[0], parentPartId: rootPartId, materialId: 'mat.base', joint: { kind: 'fixed' },
      attachment: attachment(rootStart), kind: 'segment', points: [rootStart, rootEnd],
      radii: [segmentRadius, segmentRadius], profile: 'hard'
    });
    const sparStarts: ModelPartLatticeVec3[] = [];
    const sparEnds: ModelPartLatticeVec3[] = [];
    for (let index = 0; index < sparIds.length; index += 1) {
      const offset = index === 0 ? -1 : 1;
      const sparStart = addPoints(
        rootEnd,
        scalePoint(cross, offset)
      );
      const sparEnd = addPoints(
        sparStart,
        scalePoint(extension, 5),
        scalePoint(cross, offset * 2)
      );
      sparStarts.push(sparStart);
      sparEnds.push(sparEnd);
      state.parts.push({
        partId: sparIds[index], parentPartId: rootIds[0],
        materialId: surface.configuration === 'single' ? 'mat.accent' : 'mat.dark',
        joint: { kind: 'fixed' },
        attachment: attachment(sparStart), kind: 'segment', points: [sparStart, sparEnd],
        radii: [segmentRadius, segmentRadius], profile: 'hard'
      });
    }
    // A plate owns cells on the positive normal side of its origin. For a
    // paired non-lateral span that normal is the lateral axis, so keeping the
    // origin on the spar would bury the membrane inside its own seam on half
    // of the semantic frames. Place it just outside the spar envelope. The
    // asymmetric 1/2 offset is the lattice-cell reflection of a thickness-1
    // plate around the project vertex plane (x -> -x - 1).
    const lateralCoordinate = frame.lateralAxis === 'x'
      ? sideVector[0]
      : sideVector[2];
    const membraneOrigin = pairedNonLateral && side !== null
      ? addPoints(
          rootEnd,
          scalePoint(sideVector, lateralCoordinate > 0 ? 1 : 2)
        )
      : rootEnd;
    const membraneVertices = [
      addPoints(rootEnd, scalePoint(cross, -1)),
      addPoints(rootEnd, scalePoint(cross, 1)),
      sparEnds[1]!,
      sparEnds[0]!
    ];
    state.parts.push({
      partId: membranePartIds[0],
      parentPartId: pairedNonLateral ? sparIds[0]! : rootIds[0],
      materialId: 'mat.accent',
      joint: { kind: 'fixed' },
      attachment: attachment(
        pairedNonLateral ? sparStarts[0]! : membraneOrigin
      ),
      kind: 'plate',
      plane,
      origin: membraneOrigin,
      outline: plateOutlineThrough(
        plane,
        membraneOrigin,
        membraneVertices
      ),
      thickness: 1
    });
    const directionalRelation: 'above' | 'front' | 'rear' | null =
      surface.extension === 'lateral'
        ? null
        : surface.extension === 'up' ? 'above'
          : surface.extension === 'forward' ? 'front' : 'rear';
    const spatialRelations: AuthoringSlotAssignment['spatialRelations'] = [
      ...(surface.configuration === 'paired' ? sideRelation(side!) : []),
      ...(directionalRelation === null ? [] : [directionalRelation])
    ];
    addSlot(state, {
      slotId, structuralRole: 'span', qualityStage,
      partIds: [...rootIds, ...sparIds, ...membranePartIds].sort(), parentSlotIds: [rootSlotId],
      spatialRelations,
      facing: null,
      symmetry: surface.configuration === 'paired'
        ? sideSymmetry(pairId)
        : centeredOrAsymmetric(state.program),
      support: { kind: 'none' },
      span: {
        kind: 'supported-surface', obligationId: surface.id, rootPartIds: rootIds,
        spars: sparIds.map((partId, index) => ({ sparId: `spar.${index + 1}`, partIds: [partId] })),
        membranes: [{
          membraneId: 'membrane.main',
          partIds: membranePartIds,
          boundedBySparIds: ['spar.1', 'spar.2']
        }]
      }
    });
  }
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
  rationale: `The intent program explicitly omits ${component}.`
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
