import type { IntentProgramSurfaceRole } from '../../../../project/program/types';

/** Material semantics shared by default and explicitly shaped surfaces. */
export interface SurfaceMaterialPolicy {
  readonly membraneMaterialId: 'mat.base' | 'mat.dark' | 'mat.accent';
  readonly sparMaterialId: 'mat.base' | 'mat.dark' | 'mat.accent';
}

/** Geometry retained only for shape-less V1 declarations. */
export interface DefaultSurfaceTemplate {
  readonly rootLength: number;
  readonly sparLength: number;
  readonly sparSpread: number;
}

interface SurfaceRoleDefinition {
  readonly materials: SurfaceMaterialPolicy;
  readonly defaultTemplate: DefaultSurfaceTemplate;
}

const SURFACE_ROLES: Readonly<
  Record<IntentProgramSurfaceRole, SurfaceRoleDefinition>
> = {
  wing: {
    materials: {
      sparMaterialId: 'mat.dark',
      membraneMaterialId: 'mat.accent'
    },
    defaultTemplate: { rootLength: 2, sparLength: 6, sparSpread: 2 }
  },
  fin: {
    materials: {
      sparMaterialId: 'mat.dark',
      membraneMaterialId: 'mat.base'
    },
    defaultTemplate: { rootLength: 1, sparLength: 4, sparSpread: 1 }
  },
  sail: {
    materials: {
      sparMaterialId: 'mat.base',
      membraneMaterialId: 'mat.accent'
    },
    // Radius-one spars must retain a face seam with the root. A spread of
    // two is the largest connected semantic span in the default template.
    defaultTemplate: { rootLength: 2, sparLength: 5, sparSpread: 2 }
  },
  panel: {
    materials: {
      sparMaterialId: 'mat.dark',
      membraneMaterialId: 'mat.dark'
    },
    defaultTemplate: { rootLength: 1, sparLength: 3, sparSpread: 2 }
  }
};

/** Custom geometry can observe role-owned material policy, never dimensions. */
export const surfaceMaterialPolicy = (
  role: IntentProgramSurfaceRole
): SurfaceMaterialPolicy => SURFACE_ROLES[role].materials;

export const defaultSurfaceTemplate = (
  role: IntentProgramSurfaceRole
): DefaultSurfaceTemplate => SURFACE_ROLES[role].defaultTemplate;
