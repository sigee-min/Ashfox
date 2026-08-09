import type { IntentProgramSurfaceRole } from '../../project/intentProgramTypes';

/**
 * A supported-surface role is a compiler semantic, not a label retained only
 * for intent coverage. These dimensions are expressed in the compiler's
 * semantic lattice and are applied consistently in every project frame.
 */
export interface SurfaceRoleSpec {
  readonly rootLength: number;
  readonly sparLength: number;
  readonly sparSpread: number;
  readonly membraneMaterialId: 'mat.base' | 'mat.dark' | 'mat.accent';
  readonly sparMaterialId: 'mat.base' | 'mat.dark' | 'mat.accent';
}

const SURFACE_ROLE_SPECS: Readonly<Record<IntentProgramSurfaceRole, SurfaceRoleSpec>> = {
  wing: {
    rootLength: 2,
    sparLength: 6,
    sparSpread: 2,
    sparMaterialId: 'mat.dark',
    membraneMaterialId: 'mat.accent'
  },
  fin: {
    rootLength: 1,
    sparLength: 4,
    sparSpread: 1,
    sparMaterialId: 'mat.dark',
    membraneMaterialId: 'mat.base'
  },
  sail: {
    rootLength: 2,
    sparLength: 5,
    // Radius-one spars must retain a face seam with the root. A spread of
    // two is the largest connected semantic span; its longer spars and
    // broad accent membrane still distinguish a sail from the other roles.
    sparSpread: 2,
    sparMaterialId: 'mat.base',
    membraneMaterialId: 'mat.accent'
  },
  panel: {
    rootLength: 1,
    sparLength: 3,
    sparSpread: 2,
    sparMaterialId: 'mat.dark',
    membraneMaterialId: 'mat.dark'
  }
};

export const surfaceRoleSpec = (
  role: IntentProgramSurfaceRole
): SurfaceRoleSpec => SURFACE_ROLE_SPECS[role];
