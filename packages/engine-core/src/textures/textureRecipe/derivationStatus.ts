import type { ProjectDocument } from '../../model';
import {
  activeGeneratedTextureIds,
  buildGeneratedAtlasPlan
} from './atlasPlan';
import {
  generatedTextureMatchesPlan,
  textureSettingsMatchPlan
} from './planMatching';
import { compileTextureSurfaceAuthority } from './surfaceMetrics';

export const generatedTextureMatchesDerivation = (
  document: ProjectDocument,
  textureId: string
): boolean => {
  const texture = document.textures[textureId];
  if (texture?.atlasMode !== 'generate') return true;
  const authority = compileTextureSurfaceAuthority(document);
  const plan = buildGeneratedAtlasPlan(document, authority);
  return Boolean(
    plan &&
    textureSettingsMatchPlan(document, plan) &&
    generatedTextureMatchesPlan(document, textureId, plan, authority)
  );
};

export const staleGeneratedTextureIds = (
  document: ProjectDocument
): ReadonlySet<string> => {
  const authority = compileTextureSurfaceAuthority(document);
  const textureIds = activeGeneratedTextureIds(document, authority);
  if (textureIds.length === 0) return new Set();
  const plan = buildGeneratedAtlasPlan(document, authority);
  if (!plan || !textureSettingsMatchPlan(document, plan)) {
    return new Set(textureIds);
  }
  return new Set(
    textureIds.filter(
      (textureId) =>
        !generatedTextureMatchesPlan(
          document,
          textureId,
          plan,
          authority
        )
    )
  );
};
