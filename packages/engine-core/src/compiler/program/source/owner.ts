import type { ModelPartSpec } from '../../../model';

const sourcePathForSlotId = (slotId: string): string => {
  if (slotId.startsWith('slot.surface.')) {
    return `surfaces.${slotId.slice('slot.surface.'.length).split('.')[0]}`;
  }
  if (slotId.startsWith('slot.focal.')) {
    return `focal.${slotId.slice('slot.focal.'.length).split('.')[0]}`;
  }
  for (const kind of ['limb', 'wheel'] as const) {
    const prefix = `slot.${kind}.`;
    if (!slotId.startsWith(prefix)) continue;
    return `body.${slotId.slice(prefix.length).split('.').slice(1).join('.')}`;
  }
  if (slotId.startsWith('slot.core.')) {
    return `body.${slotId.slice('slot.core.'.length).split('.')[0]}`;
  }
  if (slotId.startsWith('slot.')) {
    return `body.${slotId.slice('slot.'.length).split('.')[0]}`;
  }
  return 'model';
};

const sourcePathForPartId = (partId: string): string => {
  if (partId.startsWith('core.')) {
    return `body.${partId.slice('core.'.length).split('.')[0]}`;
  }
  for (const kind of ['mass', 'chain', 'limb', 'wheel', 'radial'] as const) {
    if (!partId.startsWith(`${kind}.`)) continue;
    const remainder = partId.slice(kind.length + 1);
    const moduleId = kind === 'limb' || kind === 'wheel'
      ? remainder.split('.').slice(1).join('.')
      : remainder;
    return `body.${moduleId}`;
  }
  if (partId.startsWith('surface.')) {
    return `surfaces.${partId.slice('surface.'.length).split('.')[0]}`;
  }
  if (partId.startsWith('focal.')) {
    return `focal.${partId.slice('focal.'.length).split('.')[0]}`;
  }
  if (partId.startsWith('face.')) return 'face';
  if (partId.startsWith('support.')) return 'support';
  return 'model';
};

/** Bridges emitted recipe diagnostics back to their source declaration. */
export const sourcePathForRecipeIssue = (
  issuePath: string,
  parts: readonly ModelPartSpec[]
): string => {
  const index = /modeling\.parts\[(\d+)]/.exec(issuePath)?.[1];
  if (index !== undefined) {
    const part = parts[Number(index)];
    if (part?.partId === 'core.structure') {
      const root = parts.find((candidate) => candidate.parentPartId === null);
      return root ? sourcePathForPartId(root.partId) : 'body';
    }
    if (part) return sourcePathForPartId(part.partId);
  }
  if (issuePath.startsWith('modeling.materials')) return 'appearance.palette';
  return 'model';
};

/** Maps a post-lowering invariant path to the declaration that owns it. */
export const sourcePathForCompilerIssue = (
  issuePath: string,
  parts: readonly ModelPartSpec[]
): string => {
  const recipePath = sourcePathForRecipeIssue(issuePath, parts);
  if (recipePath !== 'model') return recipePath;
  const surfaceId = /slots\.slot\.surface\.([^.]+)/.exec(issuePath)?.[1];
  if (surfaceId) return `surfaces.${surfaceId}`;
  const focalId = /slots\.slot\.focal\.([^.]+)/.exec(issuePath)?.[1];
  if (focalId) return `focal.${focalId}`;
  const pairedModule = /slots\.slot\.(?:limb|wheel)\.(?:left|right)\.([^.]+)/
    .exec(issuePath)?.[1];
  if (pairedModule) return `body.${pairedModule}`;
  const coreModule = /slots\.slot\.core\.([^.]+)/.exec(issuePath)?.[1];
  if (coreModule) return `body.${coreModule}`;
  const moduleId = /slots\.slot\.([^.]+)/.exec(issuePath)?.[1];
  if (moduleId) return sourcePathForSlotId(`slot.${moduleId}`);
  if (issuePath.includes('authoringProfile.face')) return 'face';
  if (issuePath.includes('support') || issuePath.includes('restPose')) return 'support';
  if (issuePath.includes('textures') || issuePath.includes('materials')) {
    return 'appearance.palette';
  }
  return 'model';
};
