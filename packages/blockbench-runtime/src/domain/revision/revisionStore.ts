import { SessionState } from '../../session';
import { hashTextToHex } from '../../shared/hash';
import { cloneSessionState } from '../project/snapshotClone';
import { sessionRevisionProjection } from '../project/snapshotProjection';

export class RevisionStore {
  private readonly cache = new Map<string, SessionState>();
  private readonly order: string[] = [];
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  hash(snapshot: SessionState): string {
    return hashSnapshot(snapshot);
  }

  track(snapshot: SessionState): string {
    const revision = hashSnapshot(snapshot);
    this.remember(snapshot, revision);
    return revision;
  }

  remember(snapshot: SessionState, revision: string): void {
    if (!revision) return;
    const cloned = cloneSessionState(snapshot);
    if (!this.cache.has(revision)) {
      this.order.push(revision);
      if (this.order.length > this.limit) {
        const oldest = this.order.shift();
        if (oldest) this.cache.delete(oldest);
      }
    }
    this.cache.set(revision, cloned);
  }

  get(revision: string): SessionState | null {
    const snapshot = this.cache.get(revision);
    return snapshot ? cloneSessionState(snapshot) : null;
  }
}

const hashSnapshot = (snapshot: SessionState): string =>
  hashTextToHex(JSON.stringify(sessionRevisionProjection(snapshot)));
