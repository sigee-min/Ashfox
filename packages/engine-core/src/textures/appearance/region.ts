import type { ProjectDocument } from '../../model';
import { compareStableText } from '../../stableOrder';

/** One immutable authoring membrane seen as a single appearance surface. */
export interface SurfaceAppearanceRegion {
  readonly semanticOwnerKey: string;
  readonly partIds: readonly string[];
  readonly attachmentPartIds: readonly string[];
  readonly composite: boolean;
}

/**
 * Private lookup authority for mapping emitted parts back to authoring-owned
 * membrane skin. Its mutable index never escapes this module.
 */
export interface SurfaceAppearanceRegionAuthority {
  readonly hasCompositeRegions: boolean;
  regionFor: (partId: string) => SurfaceAppearanceRegion | undefined;
  ownerKeyFor: (partId: string) => string;
  ownerKeysFor: (partIds: readonly string[]) => readonly string[];
}

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values)].sort(compareStableText));

const compositeOwnerKey = (
  slotId: string,
  obligationId: string,
  membraneId: string
): string =>
  `surface:${obligationId}:${slotId}:membrane:${membraneId}`;

/**
 * Builds the only part-to-membrane appearance mapping. Invalid ambiguous span
 * membership deliberately falls back to per-part ownership until validation
 * reports the malformed authoring profile.
 */
export const buildSurfaceAppearanceRegionAuthority = (
  document: ProjectDocument
): SurfaceAppearanceRegionAuthority => {
  const candidates = new Map<string, SurfaceAppearanceRegion[]>();
  let hasCompositeRegions = false;
  const slots = [...(document.authoringProfile?.slots ?? [])].sort(
    (left, right) => compareStableText(left.slotId, right.slotId)
  );
  for (const slot of slots) {
    const span = slot.span;
    if (span.kind !== 'supported-surface') continue;
    const membranes = [...span.membranes].sort(
      (left, right) => compareStableText(left.membraneId, right.membraneId)
    );
    for (const membrane of membranes) {
      const partIds = uniqueSorted(membrane.partIds);
      const firstPartId = partIds[0];
      if (!firstPartId) continue;
      const composite = partIds.length > 1;
      hasCompositeRegions ||= composite;
      const region = Object.freeze({
        semanticOwnerKey: composite
          ? compositeOwnerKey(
              slot.slotId,
              span.obligationId,
              membrane.membraneId
            )
          : firstPartId,
        partIds,
        attachmentPartIds: composite
          ? uniqueSorted(span.rootPartIds)
          : partIds,
        composite
      });
      for (const partId of partIds) {
        const entries = candidates.get(partId) ?? [];
        entries.push(region);
        candidates.set(partId, entries);
      }
    }
  }

  const regionsByPart = new Map<string, SurfaceAppearanceRegion>();
  for (const [partId, regions] of candidates) {
    if (
      regions.length === 1 ||
      regions.every(
        (region) =>
          region.semanticOwnerKey === regions[0]?.semanticOwnerKey
      )
    ) {
      const region = regions[0];
      if (region) regionsByPart.set(partId, region);
    }
  }
  const regionFor = (
    partId: string
  ): SurfaceAppearanceRegion | undefined => regionsByPart.get(partId);
  const ownerKeyFor = (partId: string): string =>
    regionFor(partId)?.semanticOwnerKey ?? partId;
  const ownerKeysFor = (
    partIds: readonly string[]
  ): readonly string[] => uniqueSorted(partIds.map(ownerKeyFor));
  return Object.freeze({
    hasCompositeRegions,
    regionFor,
    ownerKeyFor,
    ownerKeysFor
  });
};
