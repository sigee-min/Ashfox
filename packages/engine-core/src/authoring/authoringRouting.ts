import { canonicalJsonString } from '../canonicalJson';
import type { ProjectDocument } from '../model';
import {
  AUTHORING_ROUTING_CONTRACT_VERSION,
  type AuthoringRoutingSnapshot
} from './authoringTypes';

export const authoringRoutingSnapshot = (
  document: Pick<ProjectDocument, 'intent'>
): AuthoringRoutingSnapshot | null => {
  if (!document.intent) return null;
  const referenceIds = (document.intent.references ?? [])
    .map((reference) => reference.id)
    .sort((left, right) => left.localeCompare(right));
  return {
    contractVersion: AUTHORING_ROUTING_CONTRACT_VERSION,
    // Canonical authoring always retains its neutral idle. Delivery adapters
    // decide whether a selected runtime exports animation later.
    animationSupported: true,
    canonicalInput: canonicalJsonString({
      intent: {
        ...document.intent,
        references: document.intent.references ?? []
      }
    }),
    referenceIds
  };
};

export const authoringRoutingMatches = (
  document: Pick<ProjectDocument, 'intent'>,
  snapshot: AuthoringRoutingSnapshot
): boolean => {
  const current = authoringRoutingSnapshot(document);
  return current !== null &&
    canonicalJsonString(current) === canonicalJsonString(snapshot);
};
