import { canonicalJsonString } from '../canonicalJson';
import type { ProjectDocument } from '../model';
import type { AuthoringProfile } from './authoringTypes';

/**
 * Semantic intent and profile are planning authority, not mutable labels for
 * geometry that already exists. Re-authoring requires first returning to an
 * empty canonical recipe so an agent cannot weaken a contract around its own
 * result.
 */
export const hasMaterializedAuthoringParts = (
  document: ProjectDocument
): boolean => (document.modeling?.parts.length ?? 0) > 0;

/**
 * Routing is a derived snapshot of intent and references.
 * Refreshing it is not semantic re-authoring; every agent-owned declaration
 * remains frozen and must compare exactly.
 */
const comparableAuthority = (
  profile: AuthoringProfile
): Omit<AuthoringProfile, 'routing'> => {
  const { routing: _routing, ...authority } = profile;
  return authority;
};

export const authoringSemanticAuthorityEqual = (
  left: AuthoringProfile | undefined,
  right: AuthoringProfile
): boolean => {
  if (!left) return false;
  return canonicalJsonString(comparableAuthority(left)) ===
    canonicalJsonString(comparableAuthority(right));
};
