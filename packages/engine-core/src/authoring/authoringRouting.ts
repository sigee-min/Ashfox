import { canonicalJsonString } from '../canonicalJson';
import {
  animationSupportForFormatProfile,
  formatProfileSupportsAnimation
} from '../export/compatibility';
import type { ProjectDocument, ProjectFormatProfile } from '../model';
import {
  AUTHORING_ROUTING_CONTRACT_VERSION,
  type AuthoringRoutingSnapshot
} from './authoringTypes';

const targetContract = (
  profile: ProjectFormatProfile
): Readonly<Record<string, string>> => {
  switch (profile.id) {
    case 'minecraft.java_block':
      return { profileId: profile.id, assetKind: profile.modelKind };
    case 'minecraft.bedrock':
      return { profileId: profile.id, assetKind: profile.geometryKind };
    case 'minecraft.java.geckolib5':
      return { profileId: profile.id, assetKind: profile.assetKind };
    case 'gltf.2':
      return { profileId: profile.id, assetKind: 'scene' };
    case 'ashfox.generic':
      return { profileId: profile.id, assetKind: 'generic' };
  }
};

export const authoringRoutingSnapshot = (
  document: Pick<ProjectDocument, 'intent' | 'formatProfile'>
): AuthoringRoutingSnapshot | null => {
  if (!document.intent) return null;
  const referenceIds = (document.intent.references ?? [])
    .map((reference) => reference.id)
    .sort((left, right) => left.localeCompare(right));
  return {
    contractVersion: AUTHORING_ROUTING_CONTRACT_VERSION,
    animationSupported:
      formatProfileSupportsAnimation(document.formatProfile),
    canonicalInput: canonicalJsonString({
      intent: {
        ...document.intent,
        references: document.intent.references ?? []
      },
      target: {
        ...targetContract(document.formatProfile),
        animationSupport:
          animationSupportForFormatProfile(document.formatProfile)
      }
    }),
    referenceIds
  };
};

export const authoringRoutingMatches = (
  document: Pick<ProjectDocument, 'intent' | 'formatProfile'>,
  snapshot: AuthoringRoutingSnapshot
): boolean => {
  const current = authoringRoutingSnapshot(document);
  return current !== null &&
    canonicalJsonString(current) === canonicalJsonString(snapshot);
};
