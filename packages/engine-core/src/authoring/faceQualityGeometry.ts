import type { ProjectDocument } from '../model';
import {
  cellKey,
  parseCellKey
} from '../modeling/lattice';
import {
  readCompiledParts,
  type CompiledPartState
} from '../modeling/partInvariants';
import type {
  FeaturePartSpec,
  PartSpec
} from '../modeling/partContract';
import {
  areLatticeCellSetsExactReflections
} from '../modeling/partRecipeTransforms/geometry';
import {
  surfaceFeaturePixels,
  surfaceFeaturePlane
} from '../modeling/surfaceFeature';
import {
  projectSpatialFrame,
  type ProjectSpatialFrame
} from '../project/projectSpatialFrame';
import { authoringPlanIssue } from './authoringIssueFactories';
import type {
  AuthoringPlanIssue,
  AuthoringSlotStatus
} from './authoringPlanTypes';
import {
  authoringFaceComponentSlotIds,
  type ArchetypeReference,
  type AuthoringFaceComponent,
  type AuthoringFaceContract
} from './authoringTypes';

type FaceGeometryComponent = Extract<
  AuthoringFaceComponent,
  'eye' | 'nasal' | 'oral'
>;

export interface CanonicalFaceGeometryEvaluation {
  hostReady: boolean;
  invalidComponents: ReadonlySet<AuthoringFaceComponent>;
  issues: readonly AuthoringPlanIssue[];
  violations: readonly AuthoringPlanIssue[];
  ready: boolean;
}

interface CanonicalFaceGeometryInput {
  document: ProjectDocument;
  authority: ArchetypeReference;
  face: AuthoringFaceContract;
  hostPartId: string | null;
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>;
  partsById: ReadonlyMap<string, PartSpec>;
  permittedEyeSurfaceHostSlotIds: ReadonlySet<string>;
}

interface ExplicitFeatureOwner {
  component: 'nasal' | 'oral';
  slotId: string;
}

interface ProjectedVerticalBand {
  component: FaceGeometryComponent;
  minimum: number;
  maximum: number;
  centroid: number;
  partIds: readonly string[];
}

interface AnatomicalOrderEvaluation {
  invalidComponents: ReadonlySet<FaceGeometryComponent>;
  issues: readonly AuthoringPlanIssue[];
}

export const realizesFaceForm = (
  part: PartSpec,
  form: string
): boolean => {
  switch (form) {
    case 'eye':
      return part.kind === 'feature' && part.motif === 'eye';
    case 'nose':
      return part.kind === 'feature' && part.motif === 'nose';
    case 'mouth':
      return part.kind === 'feature' &&
        part.motif === 'mouth' &&
        part.glyph !== 'beak';
    case 'beak':
      return (
        part.kind === 'feature' &&
        part.motif === 'mouth' &&
        part.glyph === 'beak'
      ) || part.kind !== 'feature';
    case 'muzzle':
    case 'jaw':
    case 'orbital':
    case 'brow':
    case 'mouth-interior':
      return part.kind !== 'feature' || part.motif === 'patch';
    default:
      return false;
  }
};

const partsForComponent = (
  component: FaceGeometryComponent,
  input: CanonicalFaceGeometryInput
): readonly PartSpec[] => {
  const declaration = input.face.components.find(
    (candidate) => candidate.component === component
  );
  if (!declaration) return [];
  const partIds = authoringFaceComponentSlotIds(declaration).flatMap(
    (slotId) => input.slotsById.get(slotId)?.presentPartIds ?? []
  );
  return partIds.flatMap((partId) => {
    const part = input.partsById.get(partId);
    return part && realizesFaceForm(part, declaration.form) ? [part] : [];
  });
};

const explicitFeatureOwners = (
  part: FeaturePartSpec,
  input: CanonicalFaceGeometryInput
): readonly ExplicitFeatureOwner[] => input.face.components.flatMap(
  (declaration) => {
    const component = declaration.component;
    if (
      (component !== 'nasal' && component !== 'oral') ||
      !realizesFaceForm(part, declaration.form)
    ) {
      return [];
    }
    return authoringFaceComponentSlotIds(declaration).flatMap((slotId) =>
      input.slotsById.get(slotId)?.presentPartIds.includes(part.partId)
        ? [{ component, slotId }]
        : []
    );
  }
);

const explicitFeatureOwnershipIssue = (
  part: FeaturePartSpec,
  owners: readonly ExplicitFeatureOwner[],
  input: CanonicalFaceGeometryInput
): AuthoringPlanIssue => authoringPlanIssue(
  'authoring.plan.face_component_incomplete',
  `modeling.parts.${part.partId}`,
  `Explicit facial feature "${part.partId}" has ${owners.length} compatible declared semantic owners under the sealed face authority.`,
  'exactly one compatible nasal/oral component slot owner; no host, accent, absent-component, or duplicate laundering',
  { authority: input.authority, partIds: [part.partId] }
);

const auditExplicitFeatureOwnership = (
  input: CanonicalFaceGeometryInput
): readonly AuthoringPlanIssue[] => [...input.partsById.values()].flatMap(
  (part) => {
    if (
      part.kind !== 'feature' ||
      (part.motif !== 'nose' && part.motif !== 'mouth')
    ) {
      return [];
    }
    const owners = explicitFeatureOwners(part, input);
    return owners.length === 1
      ? []
      : [explicitFeatureOwnershipIssue(part, owners, input)];
  }
);

const axisIndex = (
  frame: ProjectSpatialFrame
): 0 | 2 => frame.direction === 'east' || frame.direction === 'west' ? 0 : 2;

const forwardSign = (
  frame: ProjectSpatialFrame
): -1 | 1 => frame.forward[axisIndex(frame)] as -1 | 1;

const forwardSurfacePlane = (
  part: CompiledPartState,
  frame: ProjectSpatialFrame
): number | null => {
  const index = axisIndex(frame);
  const sign = forwardSign(frame);
  const coordinates = [...part.occupancy.cells].map((key) => {
    const point = parseCellKey(key);
    const coordinate = index === 0 ? point.x : point.z;
    return sign === 1 ? coordinate + 1 : -coordinate;
  });
  return coordinates.length === 0 ? null : Math.max(...coordinates);
};

const featureForwardPlane = (
  feature: FeaturePartSpec,
  frame: ProjectSpatialFrame
): number => surfaceFeaturePlane(feature) * forwardSign(frame);

const featureCells = (
  feature: FeaturePartSpec
): ReadonlySet<`${number},${number},${number}`> => new Set(
  surfaceFeaturePixels(feature).map((pixel) => cellKey(pixel.boundaryCell))
);

const featureUsesForwardOuterSurface = (
  feature: FeaturePartSpec,
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): boolean => {
  if (feature.face !== frame.direction || feature.parentPartId === null) {
    return false;
  }
  const parent = compiled.get(feature.parentPartId);
  const parentPlane = parent ? forwardSurfacePlane(parent, frame) : null;
  return parentPlane !== null &&
    featureForwardPlane(feature, frame) === parentPlane &&
    [...featureCells(feature)].every((key) => parent?.occupancy.cells.has(key));
};

const projectedCellKey = (
  key: `${number},${number},${number}`,
  frame: ProjectSpatialFrame
): `${number},${number}` => {
  const point = parseCellKey(key);
  const lateral = frame.lateralAxis === 'x' ? point.x : point.z;
  return `${lateral},${point.y}`;
};

const projectedFootprint = (
  parts: readonly PartSpec[],
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): ReadonlySet<`${number},${number}`> => new Set(parts.flatMap((part) => {
  const cells = part.kind === 'feature'
    ? featureCells(part)
    : compiled.get(part.partId)?.occupancy.cells ?? new Set();
  return [...cells].map((key) => projectedCellKey(key, frame));
}));

const partCells = (
  part: PartSpec,
  compiled: ReadonlyMap<string, CompiledPartState>
): ReadonlySet<`${number},${number},${number}`> => part.kind === 'feature'
  ? featureCells(part)
  : compiled.get(part.partId)?.occupancy.cells ?? new Set();

const cellCenterAlong = (
  key: `${number},${number},${number}`,
  direction: ProjectSpatialFrame['up']
): number => {
  const point = parseCellKey(key);
  return (point.x + 0.5) * direction[0] +
    (point.y + 0.5) * direction[1] +
    (point.z + 0.5) * direction[2];
};

const componentVerticalBand = (
  component: FaceGeometryComponent,
  input: CanonicalFaceGeometryInput,
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): ProjectedVerticalBand | null => {
  const parts = partsForComponent(component, input);
  const cells = new Set(parts.flatMap((part) => [
    ...partCells(part, compiled)
  ]));
  if (parts.length === 0 || cells.size === 0) return null;
  const projectedCoordinates = new Map<string, number>();
  for (const key of cells) {
    const vertical = cellCenterAlong(key, frame.up);
    const lateral = cellCenterAlong(key, frame.left);
    projectedCoordinates.set(`${lateral},${vertical}`, vertical);
  }
  const coordinates = [...projectedCoordinates.values()];
  return {
    component,
    minimum: Math.min(...coordinates),
    maximum: Math.max(...coordinates),
    centroid: coordinates.reduce((sum, value) => sum + value, 0) /
      coordinates.length,
    partIds: parts.map((part) => part.partId)
  };
};

const anatomicalOrderIssue = (
  above: ProjectedVerticalBand,
  below: ProjectedVerticalBand,
  input: CanonicalFaceGeometryInput
): AuthoringPlanIssue => authoringPlanIssue(
  'authoring.plan.face_component_incomplete',
  'authoringProfile.face.components',
  `Organism face anatomy is inverted: ${above.component} centroid ${above.centroid} in band ${above.minimum}..${above.maximum} is not above ${below.component} centroid ${below.centroid} in band ${below.minimum}..${below.maximum} along the sealed project up axis.`,
  'projectSpatialFrame.up projected cell-center order eye > nasal > oral for every materialized component required by the sealed organism face',
  {
    authority: input.authority,
    partIds: [...above.partIds, ...below.partIds]
  }
);

const auditOrganismAnatomicalOrder = (
  input: CanonicalFaceGeometryInput,
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): AnatomicalOrderEvaluation => {
  const intent = input.document.intent;
  const invalidComponents = new Set<FaceGeometryComponent>();
  const issues: AuthoringPlanIssue[] = [];
  if (
    !intent ||
    intent.semanticContract.subjectDomain !== 'organism' ||
    intent.semanticContract.face.kind !== 'full'
  ) {
    return { invalidComponents, issues };
  }
  const sealedFace = intent.semanticContract.face;
  const relations: Array<readonly [
    FaceGeometryComponent,
    FaceGeometryComponent
  ]> = [
    ...(sealedFace.nasal === 'present'
      ? [['eye', 'nasal'] as const]
      : []),
    ...(sealedFace.oral === 'present'
      ? [['eye', 'oral'] as const]
      : []),
    ...(sealedFace.nasal === 'present' && sealedFace.oral === 'present'
      ? [['nasal', 'oral'] as const]
      : [])
  ];
  const bands = new Map<FaceGeometryComponent, ProjectedVerticalBand>();
  for (const component of new Set(relations.flat())) {
    const band = componentVerticalBand(component, input, compiled, frame);
    if (band) bands.set(component, band);
  }
  for (const [aboveComponent, belowComponent] of relations) {
    const above = bands.get(aboveComponent);
    const below = bands.get(belowComponent);
    if (!above || !below || above.centroid > below.centroid) continue;
    invalidComponents.add(aboveComponent);
    invalidComponents.add(belowComponent);
    issues.push(anatomicalOrderIssue(above, below, input));
  }
  return { invalidComponents, issues };
};

const footprintsOverlap = (
  left: ReadonlySet<`${number},${number}`>,
  right: ReadonlySet<`${number},${number}`>
): boolean => [...left].some((key) => right.has(key));

const actualPartDescendsFrom = (
  part: PartSpec,
  hostPartId: string,
  compiled: ReadonlyMap<string, CompiledPartState>
): boolean => {
  let parentId = part.kind === 'feature'
    ? part.parentPartId
    : compiled.get(part.partId)?.parentPartId ?? null;
  const visited = new Set<string>();
  while (parentId !== null && !visited.has(parentId)) {
    if (parentId === hostPartId) return true;
    visited.add(parentId);
    parentId = compiled.get(parentId)?.parentPartId ?? null;
  }
  return false;
};

const permittedEyeSurfacePartIds = (
  input: CanonicalFaceGeometryInput
): ReadonlySet<string> => new Set(
  [...input.permittedEyeSurfaceHostSlotIds].flatMap((slotId) => {
    const slot = input.slotsById.get(slotId);
    return slot?.presentPartIds.length === 1
      ? [slot.presentPartIds[0] as string]
      : [];
  })
);

const hostGeometryReady = (
  input: CanonicalFaceGeometryInput,
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): boolean => {
  if (input.hostPartId === null) return false;
  const host = compiled.get(input.hostPartId);
  if (!host || host.occupancy.cells.size === 0) return false;
  return frame.plane === null || areLatticeCellSetsExactReflections(
    host.occupancy.cells,
    host.occupancy.cells,
    frame.lateralAxis,
    frame.plane
  );
};

const eyesUseCanonicalPlanes = (
  eyes: readonly PartSpec[],
  input: CanonicalFaceGeometryInput,
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): boolean => {
  if (eyes.length === 0 || input.hostPartId === null) return true;
  const permitted = permittedEyeSurfacePartIds(input);
  const planes = new Set<number>();
  for (const part of eyes) {
    if (
      part.kind !== 'feature' ||
      part.motif !== 'eye' ||
      part.parentPartId === null ||
      !permitted.has(part.parentPartId) ||
      !featureUsesForwardOuterSurface(part, compiled, frame)
    ) {
      return false;
    }
    const parent = compiled.get(part.parentPartId);
    if (
      !parent ||
      (part.parentPartId !== input.hostPartId &&
        parent.parentPartId !== input.hostPartId)
    ) {
      return false;
    }
    planes.add(featureForwardPlane(part, frame));
  }
  return planes.size === 1;
};

const componentGeometryReady = (
  component: 'nasal' | 'oral',
  parts: readonly PartSpec[],
  hostPlane: number,
  eyeFootprint: ReadonlySet<`${number},${number}`>,
  input: CanonicalFaceGeometryInput,
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): boolean => {
  if (parts.length === 0 || input.hostPartId === null) return true;
  const separated = parts.every((part) =>
    part.partId !== input.hostPartId &&
    actualPartDescendsFrom(part, input.hostPartId as string, compiled)
  );
  const forward = parts.every((part) => {
    if (part.kind === 'feature') {
      return featureUsesForwardOuterSurface(part, compiled, frame) &&
        featureForwardPlane(part, frame) >= hostPlane;
    }
    const geometry = compiled.get(part.partId);
    const plane = geometry ? forwardSurfacePlane(geometry, frame) : null;
    return plane !== null && (
      component === 'nasal' ? plane > hostPlane : plane >= hostPlane
    );
  });
  const footprint = projectedFootprint(parts, compiled, frame);
  return separated && forward && footprint.size > 0 &&
    !footprintsOverlap(eyeFootprint, footprint);
};

const geometryIssue = (
  input: CanonicalFaceGeometryInput,
  component: FaceGeometryComponent | 'host',
  partIds: readonly string[]
): AuthoringPlanIssue => {
  if (component === 'host') {
    return authoringPlanIssue(
      'authoring.plan.face_host_incomplete',
      'authoringProfile.face.hostSlotId',
      'The full-face host is not one compiled centered cranial or display surface.',
      'canonical host occupancy present and exactly self-reflected across the bilateral project plane',
      { authority: input.authority, partIds }
    );
  }
  if (component === 'eye') {
    return authoringPlanIssue(
      'authoring.plan.face_eye_gaze_invalid',
      'authoringProfile.face.components.eye',
      'Eye features are not bound to one actual project-forward outer host or direct eye-frame plane.',
      'every eye footprint on the forward-most compiled surface of the canonical host or one direct compiled eye-frame descendant',
      { authority: input.authority, partIds }
    );
  }
  return authoringPlanIssue(
    'authoring.plan.face_component_incomplete',
    `authoringProfile.face.components.${component}`,
    `The declared ${component} component is not a separate forward facial descendant or overlaps the eye projection.`,
    component === 'nasal'
      ? 'actual descendant geometry strictly protruding beyond the host plane, or a forward surface feature, with a projected footprint disjoint from every eye'
      : 'actual descendant geometry or forward surface feature at the host plane or ahead, with a projected footprint disjoint from every eye',
    { authority: input.authority, partIds }
  );
};

export const evaluateCanonicalFaceGeometry = (
  input: CanonicalFaceGeometryInput
): CanonicalFaceGeometryEvaluation => {
  const read = readCompiledParts(input.document);
  const issues: AuthoringPlanIssue[] = [];
  const violations: AuthoringPlanIssue[] = [];
  const invalidComponents = new Set<AuthoringFaceComponent>();
  const hostPartIds = input.hostPartId ? [input.hostPartId] : [];
  if (!input.document.intent || !read.ok) {
    const issue = geometryIssue(input, 'host', hostPartIds);
    return {
      hostReady: false,
      invalidComponents,
      issues: [issue],
      violations: hostPartIds.length > 0 ? [issue] : [],
      ready: false
    };
  }
  const frame = projectSpatialFrame(input.document.intent);
  const ownershipIssues = auditExplicitFeatureOwnership(input);
  issues.push(...ownershipIssues);
  violations.push(...ownershipIssues);
  const anatomy = auditOrganismAnatomicalOrder(input, read.parts, frame);
  for (const component of anatomy.invalidComponents) {
    invalidComponents.add(component);
  }
  issues.push(...anatomy.issues);
  violations.push(...anatomy.issues);
  const hostReady = hostGeometryReady(input, read.parts, frame);
  if (!hostReady) {
    const issue = geometryIssue(input, 'host', hostPartIds);
    issues.push(issue);
    if (input.hostPartId && read.parts.has(input.hostPartId)) {
      violations.push(issue);
    }
  }
  const eyes = partsForComponent('eye', input);
  const eyesReady = eyesUseCanonicalPlanes(eyes, input, read.parts, frame);
  if (!eyesReady) {
    invalidComponents.add('eye');
    const issue = geometryIssue(
      input,
      'eye',
      eyes.map((part) => part.partId)
    );
    issues.push(issue);
    violations.push(issue);
  }
  const host = input.hostPartId ? read.parts.get(input.hostPartId) : undefined;
  const hostPlane = host ? forwardSurfacePlane(host, frame) : null;
  const eyeFootprint = projectedFootprint(eyes, read.parts, frame);
  for (const component of ['nasal', 'oral'] as const) {
    const parts = partsForComponent(component, input);
    if (
      parts.length === 0 ||
      hostPlane === null ||
      componentGeometryReady(
        component,
        parts,
        hostPlane,
        eyeFootprint,
        input,
        read.parts,
        frame
      )
    ) {
      continue;
    }
    invalidComponents.add(component);
    const issue = geometryIssue(
      input,
      component,
      parts.map((part) => part.partId)
    );
    issues.push(issue);
    violations.push(issue);
  }
  return {
    hostReady,
    invalidComponents,
    issues,
    violations,
    ready: hostReady && eyesReady && invalidComponents.size === 0 &&
      ownershipIssues.length === 0
  };
};
