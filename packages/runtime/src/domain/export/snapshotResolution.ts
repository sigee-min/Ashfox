import type { FormatKind } from '@ashfox/contracts/types/internal';
import type { SessionState } from '../../session';
import { matchesFormatKind } from '../formats';

export type MatchOverrideKind = (formatId: string) => FormatKind | null;

export const resolveSnapshotFormatKind = (
  snapshot: SessionState,
  matchOverrideKind: MatchOverrideKind
): FormatKind | null => {
  if (snapshot.format) return snapshot.format;
  if (!snapshot.formatId) return null;
  const overridden = matchOverrideKind(snapshot.formatId);
  if (overridden) return overridden;
  if (matchesFormatKind('Java Block/Item', snapshot.formatId)) return 'Java Block/Item';
  if (matchesFormatKind('geckolib', snapshot.formatId)) return 'geckolib';
  if (matchesFormatKind('animated_java', snapshot.formatId)) return 'animated_java';
  if (matchesFormatKind('Generic Model', snapshot.formatId)) return 'Generic Model';
  return null;
};
