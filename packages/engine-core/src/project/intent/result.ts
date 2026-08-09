import type { ProjectDocument, ProjectIntent } from '../../model';

export interface ProjectIntentIssue {
  readonly path: string;
  readonly message: string;
  readonly expected: string;
}

interface ProjectIntentFailure {
  readonly ok: false;
  readonly issues: readonly ProjectIntentIssue[];
}

export type NormalizeProjectIntentResult =
  | {
      readonly ok: true;
      readonly intent: ProjectIntent;
    }
  | ProjectIntentFailure;

export type ReadProjectIntentResult =
  | {
      readonly ok: true;
      readonly intent: ProjectIntent | null;
    }
  | ProjectIntentFailure;

/** Typed boundary for consumers that should not depend on normalization internals. */
export interface ProjectIntentReader {
  readonly normalize: (value: unknown) => NormalizeProjectIntentResult;
  readonly read: (
    document: Pick<ProjectDocument, 'intent'>
  ) => ReadProjectIntentResult;
}

const joinedPath = (base: string, field: string): string =>
  field.startsWith('[') ? `${base}${field}` : `${base}.${field}`;

/** One insertion-ordered issue authority shared by every intent reader. */
export class ProjectIntentIssueCollector {
  private readonly collected: ProjectIntentIssue[] = [];

  get size(): number { return this.collected.length; }

  add(path: string, message: string, expected: string): void {
    this.collected.push(Object.freeze({ path, message, expected }));
  }

  addAt(
    base: string,
    field: string,
    message: string,
    expected: string
  ): void {
    this.add(joinedPath(base, field), message, expected);
  }

  /** Bridges structurally identical owner readers without exposing their array. */
  capture<T>(reader: (issues: ProjectIntentIssue[]) => T): T {
    return reader(this.collected);
  }

  failure(): ProjectIntentFailure {
    return Object.freeze({
      ok: false,
      issues: Object.freeze(this.collected.map((issue) =>
        Object.freeze({ ...issue })
      ))
    });
  }
}
