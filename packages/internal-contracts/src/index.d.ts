export declare const INTERNAL_CONTRACT_VERSIONS: Readonly<{
  readonly projectDocument: 1;
  readonly authoringProfile: 2;
  readonly authoringRouting: 1;
  readonly commandReceipt: 1;
  readonly exportBundle: 1;
  readonly localProjectRecord: 1;
  readonly visualReviewReceipt: 1;
  readonly sidecarIpc: 1;
  readonly traceLog: 1;
  readonly galleryCatalog: 1;
  readonly skillReleaseDescriptor: 1;
}>;

export type InternalContractVersions =
  typeof INTERNAL_CONTRACT_VERSIONS;
export type InternalContractName = keyof InternalContractVersions;
export type InternalContractVersion<
  TName extends InternalContractName
> = InternalContractVersions[TName];

export declare const isCurrentInternalContractVersion: <
  TName extends InternalContractName
>(
  name: TName,
  value: unknown
) => value is InternalContractVersion<TName>;

export declare const isClosedContractRecord: (
  value: unknown
) => value is Readonly<Record<string, unknown>>;
export declare const isDenseContractArray: (
  value: unknown
) => value is readonly unknown[];
export type FiniteJsonValue =
  | null
  | string
  | boolean
  | number
  | FiniteJsonValue[]
  | { [key: string]: FiniteJsonValue };
export type FiniteJsonSnapshotResult =
  | { ok: true; value: unknown }
  | { ok: false };
export declare const createFiniteJsonSnapshot: (
  value: unknown,
  options?: {
    depthAllowance?: number;
    omitUndefinedObjectProperties?: boolean;
    objectPrototype?: 'null' | 'standard';
  }
) => FiniteJsonSnapshotResult;
export declare const FINITE_JSON_CONTRACT_MAX_DEPTH: 64;
export declare const FINITE_JSON_CONTRACT_MAX_CONTAINERS: 100000;
export declare const isFiniteJsonValue: (
  value: unknown
) => value is FiniteJsonValue;
export declare const hasExactContractKeys: (
  value: object,
  keys: ReadonlySet<string>
) => boolean;
export declare const isCanonicalIsoDate: (
  value: unknown
) => value is string;
export declare const isNonEmptyContractText: (
  value: unknown
) => value is string;
export declare const isUniqueContractTextArray: (
  value: unknown
) => value is readonly string[];
export declare const utf8ContractByteLength: (value: string) => number;
