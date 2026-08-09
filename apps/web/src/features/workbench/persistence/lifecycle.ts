'use client';

import { useRef } from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';
import {
  useLatestValue
} from '../../../hooks/useLatestValue';

export const usePersistenceLifecycle = (
  document: ProjectDocument
) => {
  const currentDocument = useLatestValue(document);
  const session = useRef(0);
  const saveRequest = useRef(0);
  return {
    currentDocument,
    session,
    saveRequest
  };
};

export type PersistenceLifecycle = ReturnType<
  typeof usePersistenceLifecycle
>;
