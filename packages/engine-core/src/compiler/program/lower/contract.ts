import type { ModelPartLatticeVec3 } from '../../../model';
import type {
  IntentProgramAttachmentAnchor,
  IntentProgramAttachmentLane,
  IntentProgramGrowthDirection
} from '../../../project/program/types';

export type Side = 'left' | 'right';

export interface IntentProgramBodyPort {
  anchor: IntentProgramAttachmentAnchor;
  growth: IntentProgramGrowthDirection;
  lane: IntentProgramAttachmentLane;
  lateral: number;
  up: number;
  forward: number;
}

export interface IntentProgramLimbMember {
  side: Side;
  partId: string;
  slotId: string;
  endpoint: ModelPartLatticeVec3;
}

export interface IntentProgramLimbPair {
  moduleId: string;
  members: readonly IntentProgramLimbMember[];
}

export interface IntentProgramWheelMember {
  side: Side;
  partId: string;
  slotId: string;
}

export interface IntentProgramWheelPair {
  moduleId: string;
  members: readonly IntentProgramWheelMember[];
}

export interface IntentProgramModuleHost {
  moduleId: string;
  partId: string;
  slotId: string;
}
