import type {
  BoneNode,
  CubeNode,
  GeneratedNodeProvenance
} from '../../model';
import type { OccupancyGrid } from '../types';

export type PartInvariantCode =
  | 'provenance'
  | 'grid'
  | 'hierarchy'
  | 'connectivity'
  | 'attachment'
  | 'overlap'
  | 'surface'
  | 'silhouette'
  | 'rig'
  | 'budget'
  | 'projection';

export interface PartInvariantIssue {
  code: PartInvariantCode;
  path: string;
  message: string;
  entityIds: readonly string[];
  clipIds?: readonly string[];
}

export interface CompiledPartState {
  partId: string;
  parentPartId: string | null;
  materialId: string;
  primitive: GeneratedNodeProvenance['primitive'];
  joint: GeneratedNodeProvenance['joint'];
  bone: BoneNode;
  cubes: readonly CubeNode[];
  occupancy: OccupancyGrid;
}

export type ReadCompiledPartsResult =
  | {
      ok: true;
      parts: ReadonlyMap<string, CompiledPartState>;
    }
  | {
      ok: false;
      issues: readonly PartInvariantIssue[];
    };
