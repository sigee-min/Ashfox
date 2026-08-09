import type { PixelToneRole } from '../pixelRectShade';
import type { SurfacePatternComponent } from './components';
import type {
  SurfaceAppearanceTonePolicy,
  SurfaceAppearanceV1
} from './contract';
import {
  buildSurfaceMarkingMasks,
  type GeneratedSurfaceMarkingMask
} from './budget';
import { selectAppearanceRoleKeys } from './islands';
import {
  appearanceRoleBudget,
  appearanceSampleKey,
  appearanceToneSamples,
  protectedAppearanceKeys
} from './sampling';
import { freezeSurfaceAppearance } from './snapshot';

export type GeneratedSurfaceTonePolicy = SurfaceAppearanceTonePolicy;

export interface GeneratedSurfaceToneField {
  readonly appearance: SurfaceAppearanceV1;
  readonly bounds: SurfacePatternComponent['bounds'];
  readonly shadowKeys: readonly string[];
  readonly lightKeys: readonly string[];
  readonly markingMasks?: readonly GeneratedSurfaceMarkingMask[];
}

const includesSorted = (entries: readonly string[], key: string): boolean => {
  let minimum = 0;
  let maximum = entries.length - 1;
  while (minimum <= maximum) {
    const index = Math.floor((minimum + maximum) / 2);
    const candidate = entries[index];
    if (candidate === key) return true;
    if (candidate !== undefined && candidate < key) minimum = index + 1;
    else maximum = index - 1;
  }
  return false;
};

export const generatedSurfaceToneRole = (
  field: GeneratedSurfaceToneField,
  u: number,
  v: number
): PixelToneRole => {
  const key = appearanceSampleKey(u, v);
  if (includesSorted(field.shadowKeys, key)) return 'shadow';
  if (includesSorted(field.lightKeys, key)) return 'light';
  return 'base';
};

export const buildGeneratedSurfaceToneField = (
  component: SurfacePatternComponent,
  appearance: SurfaceAppearanceV1
): GeneratedSurfaceToneField => {
  const snapshot = freezeSurfaceAppearance(appearance);
  const samples = appearanceToneSamples(component, snapshot);
  const budget = appearanceRoleBudget(component, snapshot);
  const roles = selectAppearanceRoleKeys(
    samples,
    budget.shadow,
    budget.light,
    protectedAppearanceKeys(snapshot, samples),
    component
  );
  const markingMasks = buildSurfaceMarkingMasks(
    component,
    snapshot,
    [...roles.shadow, ...roles.light]
  );
  return Object.freeze({
    appearance: snapshot,
    bounds: Object.freeze({ ...component.bounds }),
    shadowKeys: roles.shadow,
    lightKeys: roles.light,
    ...(markingMasks === undefined ? {} : { markingMasks })
  });
};
