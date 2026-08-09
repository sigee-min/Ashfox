import { findSixConnectedComponents } from '../connectivity';
import { createOccupancyGrid } from '../lattice';
import type { PartSpec } from '../part';
import {
  orthographicContributionMetrics,
  resolveAttachmentAnchor
} from '../part/quality';
import {
  projectSurfaceFeaturePlacement,
  surfaceFeaturePixels,
  validateSurfaceFeaturePlacement
} from '../surface/feature';
import type { CellKey } from '../contract';
import type {
  CanonicalizationFailure,
  CanonicalizePartOccupanciesResult,
  CanonicalPartOccupancy
} from './contract';

type SurfaceFeature = Extract<PartSpec, { kind: 'feature' }>;

const resolveAttachments = (
  canonical: readonly CanonicalPartOccupancy[]
): readonly CanonicalPartOccupancy[] | CanonicalizationFailure => {
  const byPart = new Map<string, CanonicalPartOccupancy>();
  for (const part of canonical) byPart.set(part.spec.partId, part);
  const resolved: CanonicalPartOccupancy[] = [];
  for (const part of canonical) {
    const parentPartId = part.spec.parentPartId;
    if (parentPartId === null) {
      resolved.push(part);
      continue;
    }
    const parent = byPart.get(parentPartId);
    const attachment = part.spec.attachment;
    if (!parent || !attachment) {
      return {
        ok: false,
        path: `parts.${part.spec.partId}.attachment`,
        message: `Part "${part.spec.partId}" requires an existing parent and attachment anchors.`
      };
    }
    const anchor = resolveAttachmentAnchor(
      part.spec.partId,
      parentPartId,
      part.canonical,
      parent.canonical,
      {
        x: attachment.parentAnchor[0],
        y: attachment.parentAnchor[1],
        z: attachment.parentAnchor[2]
      }
    );
    if (!anchor) {
      return {
        ok: false,
        path: `parts.${part.spec.partId}.attachment`,
        message: `Part "${part.spec.partId}" has no face contact with its parent after semantic seam ownership.`
      };
    }
    const detachedComponent = findSixConnectedComponents(
      part.canonical
    ).find((component) =>
      resolveAttachmentAnchor(
        part.spec.partId,
        parentPartId,
        createOccupancyGrid(part.canonical.density, component),
        parent.canonical,
        {
          x: attachment.parentAnchor[0],
          y: attachment.parentAnchor[1],
          z: attachment.parentAnchor[2]
        }
      ) === null
    );
    if (detachedComponent) {
      return {
        ok: false,
        path: `parts.${part.spec.partId}.attachment`,
        message:
          `Every cuboid group in child part "${part.spec.partId}" ` +
          'must contact its semantic parent.'
      };
    }
    const canonicalAttachmentAnchor = { ...anchor.anchor };
    resolved.push({
      ...part,
      canonicalAttachmentAnchor,
      metric: {
        ...part.metric,
        canonicalAttachmentAnchor: [
          canonicalAttachmentAnchor.x,
          canonicalAttachmentAnchor.y,
          canonicalAttachmentAnchor.z
        ],
        attachmentSnapDistanceCells: anchor.distanceCells
      }
    });
  }
  return resolved;
};

const validateSilhouette = (
  parts: readonly CanonicalPartOccupancy[]
): CanonicalizationFailure | null => {
  const occupancyByPart = new Map<string, {
    readonly partId: string;
    readonly occupancy: CanonicalPartOccupancy['canonical'];
  }>();
  for (const part of parts) {
    occupancyByPart.set(part.spec.partId, {
      partId: part.spec.partId,
      occupancy: part.canonical
    });
  }
  const visiblePartIds = new Set<string>();
  for (const metric of orthographicContributionMetrics(occupancyByPart)) {
    if (metric.visibleCellCount > 0) visiblePartIds.add(metric.partId);
  }
  const hidden = parts.find(
    (part) => !visiblePartIds.has(part.spec.partId)
  );
  return hidden
    ? {
        ok: false,
        path: `parts.${hidden.spec.partId}`,
        message: `Canonical seam ownership leaves part "${hidden.spec.partId}" without an orthographic silhouette contribution.`
      }
    : null;
};

const projectAndValidateFeatures = (
  ordered: readonly PartSpec[],
  geometry: readonly CanonicalPartOccupancy[]
):
  | { ok: true; features: readonly SurfaceFeature[] }
  | CanonicalizationFailure => {
  const byPart = new Map<string, CanonicalPartOccupancy>();
  const environment = new Set<CellKey>();
  for (const part of geometry) {
    byPart.set(part.spec.partId, part);
    for (const key of part.canonical.cells) environment.add(key);
  }
  const featurePixelOwners = new Map<string, SurfaceFeature[]>();
  const projectedFeatures: SurfaceFeature[] = [];
  for (const part of ordered) {
    if (part.kind !== 'feature') continue;
    const feature = part;
    const parent = feature.parentPartId === null
      ? undefined
      : byPart.get(feature.parentPartId);
    if (!parent) {
      return {
        ok: false,
        path: `parts.${feature.partId}.parentPartId`,
        message: `Surface feature "${feature.partId}" requires a geometric parent.`
      };
    }
    const projected = feature.motif === 'eye'
      ? validateSurfaceFeaturePlacement(
          feature,
          parent.canonical,
          environment
        ) === null
        ? feature
        : null
      : projectSurfaceFeaturePlacement(
          feature,
          parent.canonical,
          environment
        );
    if (!projected) {
      return {
        ok: false,
        path: `parts.${feature.partId}.anchor`,
        message:
          `Surface feature "${feature.partId}" does not fit on an ` +
          `uncovered ${feature.face} face of parent ` +
          `"${feature.parentPartId}" at size ` +
          `${feature.size[0]}×${feature.size[1]}.` +
          (feature.motif === 'eye'
            ? ' Eye anchors are explicit and are never independently snapped.'
            : '')
      };
    }
    for (const pixel of surfaceFeaturePixels(projected)) {
      const owners = featurePixelOwners.get(pixel.key);
      const conflict = owners?.find(
        (owner) =>
          !(
            (owner.motif === 'patch') !==
            (projected.motif === 'patch')
          )
      );
      if (conflict) {
        return {
          ok: false,
          path: `parts.${projected.partId}.anchor`,
          message:
            `Surface features "${conflict.partId}" and ` +
            `"${projected.partId}" overlap on the same generated surface ` +
            'pixels. Only one broad patch may sit beneath a focal glyph.'
        };
      }
      if (owners) owners.push(projected);
      else featurePixelOwners.set(pixel.key, [projected]);
    }
    projectedFeatures.push(projected);
  }
  return { ok: true, features: projectedFeatures };
};

/** Runs attachment, silhouette, and surface-feature validation in order. */
export const validateCanonicalOccupancies = (
  ordered: readonly PartSpec[],
  canonical: readonly CanonicalPartOccupancy[]
): CanonicalizePartOccupanciesResult => {
  const resolved = resolveAttachments(canonical);
  if ('ok' in resolved) return resolved;
  const silhouetteIssue = validateSilhouette(resolved);
  if (silhouetteIssue) return silhouetteIssue;
  const features = projectAndValidateFeatures(ordered, resolved);
  return features.ok
    ? { ok: true, parts: resolved, features: features.features }
    : features;
};
