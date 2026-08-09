import { canonicalJsonString } from '../../canonicalJson';
import type {
  CubeFaceDirection,
  ModelGeometryPrimitive,
  ProjectDocument,
  Vec3
} from '../../model';
import type { PartSpec } from '../../modeling/part';
import { readPartRecipe } from '../../modeling/recipe';
import type { LatticeBounds } from '../../modeling/contract';
import type { AuthoringSlotAssignment } from '../../authoring/contract';
import { compareStableText } from '../../stableOrder';
import {
  SURFACE_APPEARANCE_VERSION,
  type SurfaceAppearanceProjectFrame,
  type SurfaceAppearanceProtectedRegion,
  type SurfaceAppearanceSeed,
  type SurfaceAppearanceTonePolicy,
  type SurfaceAppearanceV1,
  type SurfaceDecorationProfile,
  type SurfaceTextureIntentV1
} from './contract';
import {
  createSurfaceAppearanceFrame,
  surfaceFaceAspect
} from './frame';
import {
  planSurfaceMarkings,
  surfaceMarkingsForFace
} from './plan';
import {
  buildSurfaceAppearanceRegionAuthority,
  type SurfaceAppearanceRegionAuthority
} from './region';
import { freezeSurfaceAppearance } from './snapshot';

interface SurfaceAppearancePartAuthority {
  readonly semanticOwnerKey: string;
  readonly semanticRegion?: 'membrane';
  readonly profile: SurfaceDecorationProfile;
  readonly attachmentPoints: readonly Vec3[];
}

export interface SurfaceAppearanceCompiler {
  readonly frame: SurfaceAppearanceProjectFrame;
  appearanceFor: (
    partId: string,
    geometry: ModelGeometryPrimitive,
    faceDirection: CubeFaceDirection,
    plane: number,
    tonePolicy: SurfaceAppearanceTonePolicy,
    protectedRegions?: readonly SurfaceAppearanceProtectedRegion[]
  ) => SurfaceAppearanceV1;
}

export interface SurfaceAppearanceCompilerOptions {
  readonly seed?: SurfaceAppearanceSeed;
  readonly texture?: SurfaceTextureIntentV1;
  readonly coordinateScale?: number;
}

const profilePriority: Readonly<Record<SurfaceDecorationProfile, number>> = {
  body: 0,
  articulated: 1,
  wing: 2,
  fin: 2,
  sail: 2,
  panel: 2,
  rotary: 3,
  support: 4,
  accent: 5,
  focal: 6
};

const supportedSurfaceProfile = (
  document: ProjectDocument,
  slot: AuthoringSlotAssignment
): SurfaceDecorationProfile | null => {
  const span = slot.span;
  if (span.kind !== 'supported-surface') return null;
  return document.intent?.semanticContract.supportedSurfaces.find(
    (surface) => surface.id === span.obligationId
  )?.role ?? null;
};

const slotProfile = (
  document: ProjectDocument,
  slot: AuthoringSlotAssignment
): SurfaceDecorationProfile => {
  if (
    slot.qualityStage === 'focal' ||
    slot.structuralRole === 'focal-frame'
  ) return 'focal';
  if (slot.support.kind !== 'none') return 'support';
  const surface = supportedSurfaceProfile(document, slot);
  if (surface) return surface;
  switch (slot.structuralRole) {
    case 'rotary': return 'rotary';
    case 'articulated': return 'articulated';
    case 'accent': return 'accent';
    case 'span': return 'articulated';
    case 'axis':
    case 'core':
      return 'body';
  }
};

const profileByPart = (
  document: ProjectDocument
): ReadonlyMap<string, SurfaceDecorationProfile> => {
  const profiles = new Map<string, SurfaceDecorationProfile>();
  for (const slot of document.authoringProfile?.slots ?? []) {
    const profile = slotProfile(document, slot);
    for (const partId of slot.partIds) {
      const current = profiles.get(partId);
      if (!current || profilePriority[profile] > profilePriority[current]) {
        profiles.set(partId, profile);
      }
    }
  }
  return profiles;
};

const recipeParts = (
  document: ProjectDocument
): ReadonlyMap<string, PartSpec> => {
  const recipe = readPartRecipe(document);
  return recipe.ok && recipe.recipe
    ? new Map(recipe.recipe.parts.map((part) => [part.partId, part]))
    : new Map();
};

const automaticGeometry = (
  document: ProjectDocument,
  regions: SurfaceAppearanceRegionAuthority
) => {
  const recipe = readPartRecipe(document);
  const parts = recipe.ok && recipe.recipe
    ? [...recipe.recipe.parts]
        .sort((left, right) => compareStableText(left.partId, right.partId))
        .map(({ materialId: _materialId, ...part }) => part)
    : [];
  const slots = [...(document.authoringProfile?.slots ?? [])]
    .sort((left, right) => compareStableText(left.slotId, right.slotId));
  const legacy = {
    intent: document.intent ? {
      forward: document.intent.forward,
      symmetry: document.intent.symmetry,
      semanticContract: document.intent.semanticContract
    } : null,
    slots,
    parts
  };
  if (!regions.hasCompositeRegions) return legacy;

  const semanticParts = parts.map((part) => {
    const region = regions.regionFor(part.partId);
    if (!region?.composite) return part;
    const {
      partId: _partId,
      parentPartId,
      ...geometry
    } = part;
    return {
      semanticOwnerKey: region.semanticOwnerKey,
      parentOwnerKey: parentPartId === null
        ? null
        : regions.ownerKeyFor(parentPartId),
      geometry
    };
  }).sort((left, right) => compareStableText(
    canonicalJsonString(left),
    canonicalJsonString(right)
  ));
  const semanticSlots = slots.map((slot) => {
    const span = slot.span;
    if (span.kind !== 'supported-surface') {
      return {
        ...slot,
        partIds: regions.ownerKeysFor(slot.partIds)
      };
    }
    return {
      ...slot,
      partIds: regions.ownerKeysFor(slot.partIds),
      span: {
        ...span,
        rootPartIds: regions.ownerKeysFor(span.rootPartIds),
        spars: [...span.spars]
          .sort((left, right) => compareStableText(left.sparId, right.sparId))
          .map((spar) => ({
            ...spar,
            partIds: regions.ownerKeysFor(spar.partIds)
          })),
        membranes: [...span.membranes]
          .sort((left, right) =>
            compareStableText(left.membraneId, right.membraneId)
          )
          .map((membrane) => ({
            ...membrane,
            partIds: regions.ownerKeysFor(membrane.partIds)
          }))
      }
    };
  });
  return {
    ...legacy,
    slots: semanticSlots,
    parts: semanticParts
  };
};

const automaticMaterialSeed = (
  document: ProjectDocument,
  texture: SurfaceTextureIntentV1,
  regions: SurfaceAppearanceRegionAuthority
): SurfaceAppearanceSeed => {
  const geometry = automaticGeometry(document, regions);
  return {
    kind: 'auto',
    semanticKey: canonicalJsonString({
      ...geometry,
      texture: {
        kind: texture.kind,
        scale: texture.scale,
        density: texture.density
      }
    })
  };
};

const automaticMarkingSeed = (
  document: ProjectDocument,
  regions: SurfaceAppearanceRegionAuthority
): SurfaceAppearanceSeed => ({
  kind: 'auto',
  semanticKey: canonicalJsonString(automaticGeometry(document, regions))
});

const defaultTexture = (
  document: ProjectDocument
): SurfaceTextureIntentV1 => document.intent?.semanticContract.subjectDomain ===
  'organism'
  ? {
      kind: 'mottle',
      scale: 'broad',
      density: 'balanced',
      contrast: 'subtle'
    }
  : {
      kind: 'brushed',
      scale: 'medium',
      density: 'sparse',
      contrast: 'subtle'
    };

const partAuthority = (
  partId: string,
  geometry: ModelGeometryPrimitive,
  profiles: ReadonlyMap<string, SurfaceDecorationProfile>,
  parts: ReadonlyMap<string, PartSpec>,
  regions: SurfaceAppearanceRegionAuthority,
  tonePolicy: SurfaceAppearanceTonePolicy,
  coordinateScale: number
): SurfaceAppearancePartAuthority => {
  const region = regions.regionFor(partId);
  const profile = tonePolicy === 'focal'
    ? 'focal'
    : profiles.get(partId) ?? (geometry === 'radial' ? 'rotary' : 'body');
  return {
    semanticOwnerKey: region?.semanticOwnerKey ?? partId,
    ...(region?.composite ? { semanticRegion: 'membrane' as const } : {}),
    profile,
    attachmentPoints: (region?.attachmentPartIds ?? [partId]).flatMap(
      (attachmentPartId) => {
        const part = parts.get(attachmentPartId);
        return part?.attachment ? [[
          part.attachment.parentAnchor[0] * coordinateScale,
          part.attachment.parentAnchor[1] * coordinateScale,
          part.attachment.parentAnchor[2] * coordinateScale
        ] as const] : [];
      }
    )
  };
};

const scaledBounds = (
  bounds: LatticeBounds,
  scale: number
): LatticeBounds => ({
  min: {
    x: bounds.min.x * scale,
    y: bounds.min.y * scale,
    z: bounds.min.z * scale
  },
  max: {
    x: bounds.max.x * scale,
    y: bounds.max.y * scale,
    z: bounds.max.z * scale
  }
});

const scaledRegions = (
  regions: readonly SurfaceAppearanceProtectedRegion[],
  scale: number
): readonly SurfaceAppearanceProtectedRegion[] => regions.map((region) => ({
  x: region.x * scale,
  y: region.y * scale,
  width: region.width * scale,
  height: region.height * scale
}));

export const createSurfaceAppearanceCompiler = (
  document: ProjectDocument,
  assetBounds: LatticeBounds,
  options: SurfaceAppearanceCompilerOptions = {}
): SurfaceAppearanceCompiler => {
  const coordinateScale = options.coordinateScale ?? 1;
  if (!Number.isFinite(coordinateScale) || coordinateScale <= 0) {
    throw new RangeError('Surface appearance coordinate scale must be positive.');
  }
  const frame = createSurfaceAppearanceFrame(
    document,
    scaledBounds(assetBounds, coordinateScale)
  );
  const profiles = profileByPart(document);
  const parts = recipeParts(document);
  const regions = buildSurfaceAppearanceRegionAuthority(document);
  const authoredAppearance = document.intent?.appearance;
  const texture = options.texture ?? authoredAppearance?.texture ??
    defaultTexture(document);
  const seed = options.seed ?? (
    authoredAppearance?.seed.kind === 'explicit'
      ? authoredAppearance.seed
      : automaticMaterialSeed(document, texture, regions)
  );
  const markingSeed = options.seed ?? (
    authoredAppearance?.seed.kind === 'explicit'
      ? authoredAppearance.seed
      : automaticMarkingSeed(document, regions)
  );
  const markingAuthorities = planSurfaceMarkings(
    document,
    markingSeed,
    coordinateScale,
    regions
  );
  return Object.freeze({
    frame,
    appearanceFor: (
      partId: string,
      geometry: ModelGeometryPrimitive,
      faceDirection: CubeFaceDirection,
      plane: number,
      tonePolicy: SurfaceAppearanceTonePolicy,
      protectedRegions: readonly SurfaceAppearanceProtectedRegion[] = []
    ): SurfaceAppearanceV1 => {
      const authority = partAuthority(
        partId,
        geometry,
        profiles,
        parts,
        regions,
        tonePolicy,
        coordinateScale
      );
      const aspect = surfaceFaceAspect(faceDirection, frame);
      return freezeSurfaceAppearance({
        version: SURFACE_APPEARANCE_VERSION,
        seed,
        semanticOwnerKey: authority.semanticOwnerKey,
        ...(authority.semanticRegion === undefined
          ? {}
          : { semanticRegion: authority.semanticRegion }),
        domain: document.intent?.semanticContract.subjectDomain ?? 'neutral',
        texture,
        decoration: authority.profile,
        geometry,
        faceDirection,
        faceAspect: aspect,
        plane: plane * coordinateScale,
        attachmentPoints: Object.freeze([...authority.attachmentPoints]),
        protectedRegions: Object.freeze(
          scaledRegions(protectedRegions, coordinateScale)
        ),
        ...(authoredAppearance === undefined ? {} : {
          markings: surfaceMarkingsForFace(
            markingAuthorities,
            partId,
            aspect
          )
        }),
        frame,
        tonePolicy
      });
    }
  });
};
