import type { ConstrainedModelRecipe } from '../../model';
import type { LatticeVec3 } from '../partContract';
import type { Axis } from '../types';

export interface PartIdMirrorMapping {
  sourcePartId: string;
  targetPartId: string;
}

export interface MirrorPartRecipeInput {
  rootPartId: string;
  axis: Axis;
  plane: number;
  partIdMap: readonly PartIdMirrorMapping[];
}

export interface DeriveMirrorPartIdMapInput {
  rootPartId: string;
  axis: Axis;
  plane: number;
  targetRootPartId?: string;
}

export interface TranslatePartSubtreeInput {
  rootPartId: string;
  translation: LatticeVec3;
}

export interface PartRecipeTransformIssue {
  path: string;
  message: string;
}

export type PartRecipeTransformResult =
  | {
      ok: true;
      recipe: ConstrainedModelRecipe;
      affectedPartIds: readonly string[];
    }
  | {
      ok: false;
      issues: readonly PartRecipeTransformIssue[];
    };
