export interface AuthoringSpanSpar {
  sparId: string;
  partIds: readonly string[];
}

export interface AuthoringSpanMembrane {
  membraneId: string;
  partIds: readonly string[];
  boundedBySparIds: readonly [string, string];
}

/**
 * A span is a closed semantic surface graph layered above segment/plate
 * primitives. Its regions exhaust one slot so geometry cannot escape review.
 */
export type AuthoringSpan =
  | { kind: 'none' }
  | {
      kind: 'supported-surface';
      /** Stable upstream ProjectIntent supported-surface obligation ID. */
      obligationId: string;
      rootPartIds: readonly string[];
      spars: readonly AuthoringSpanSpar[];
      membranes: readonly AuthoringSpanMembrane[];
    };
