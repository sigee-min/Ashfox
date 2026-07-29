import type { ProjectDocument } from '@ashfox/engine-core';

import {
  createDefaultDemoHistory,
  DEFAULT_DEMO
} from './demo/demoRegistry';

export const WORKBENCH_PROJECT_ID = DEFAULT_DEMO.id;

export const createWorkbenchProject = (): ProjectDocument =>
  createDefaultDemoHistory().present;
