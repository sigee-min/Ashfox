import type { AssetProject } from '@ashfox/engine-core';
import { createBlankWorkbenchProject } from '../../src/features/workbench/newProject';

export const WORKBENCH_PROJECT_ID = 'project-local-workbench';

/** Returns an isolated compiler-created AssetProject for Workbench tests. */
export const createWorkbenchProject = (): AssetProject =>
  createBlankWorkbenchProject('2026-07-29T00:00:00.000Z');
