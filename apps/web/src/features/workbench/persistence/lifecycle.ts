'use client';

import { useRef } from 'react';

import type { AssetProject } from '@ashfox/engine-core';
import { useLatestValue } from '../../../hooks/useLatestValue';

export const usePersistenceLifecycle = (project: AssetProject) => {
  const currentProject = useLatestValue(project);
  const session = useRef(0);
  const saveRequest = useRef(0);
  return { currentProject, session, saveRequest };
};

export type PersistenceLifecycle = ReturnType<typeof usePersistenceLifecycle>;
