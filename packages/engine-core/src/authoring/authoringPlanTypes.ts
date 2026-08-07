import type {
  AuthoringAuthorityReference,
  AuthoringContact,
  AuthoringPartKind,
  AuthoringQualityStage,
  AuthoringSpatialRelation,
  AuthoringStructuralRole
} from './authoringTypes';

export type AuthoringSlotState =
  | 'planned'
  | 'complete'
  | 'missing'
  | 'invalid';

export interface AuthoringSlotStatus {
  slotId: string;
  label: string;
  authority: AuthoringAuthorityReference;
  authorityType: 'archetype' | 'specialist';
  required: boolean;
  structuralRole: AuthoringStructuralRole | null;
  qualityStage: AuthoringQualityStage;
  acceptedPartKinds: readonly AuthoringPartKind[];
  minParts: number;
  maxParts: number;
  parentSlotIds: readonly string[];
  spatialRelations: readonly AuthoringSpatialRelation[];
  facing: 'forward' | null;
  pairId: string | null;
  contact: AuthoringContact | null;
  attachmentPortId: string | null;
  hostSlotId: string | null;
  partIds: readonly string[];
  presentPartIds: readonly string[];
  missingPartIds: readonly string[];
  invalidKindPartIds: readonly string[];
  invalidHierarchyPartIds: readonly string[];
  invalidSpatialPartIds: readonly string[];
  invalidFacingPartIds: readonly string[];
  state: AuthoringSlotState;
  instruction: string;
}

export interface AuthoringPlanIssue {
  code: `authoring.plan.${string}`;
  path: string;
  message: string;
  expected: string;
  authority?: AuthoringAuthorityReference;
  partIds?: readonly string[];
  clipIds?: readonly string[];
}
