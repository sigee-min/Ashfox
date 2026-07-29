'use client';

import { useEffect } from 'react';
import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js';

interface WorkbenchShortcutHandlers {
  onUndo: () => void;
  onRedo: () => void;
  onTransformMode: (mode: TransformControlsMode) => void;
  onTogglePlayback: () => void;
  onClosePanels: () => void;
}

const INTERACTIVE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="combobox"]',
  '[role="textbox"]'
].join(',');

const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest(INTERACTIVE_SELECTOR) !== null;

export const useWorkbenchShortcuts = ({
  onUndo,
  onRedo,
  onTransformMode,
  onTogglePlayback,
  onClosePanels
}: WorkbenchShortcutHandlers): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isInteractive(event.target)) return;

      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
        return;
      }

      if (event.key.toLowerCase() === 'w') onTransformMode('translate');
      if (event.key.toLowerCase() === 'e') onTransformMode('rotate');
      if (event.key.toLowerCase() === 'r') onTransformMode('scale');
      if (event.code === 'Space') {
        event.preventDefault();
        onTogglePlayback();
      }
      if (event.key === 'Escape') onClosePanels();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onClosePanels,
    onRedo,
    onTogglePlayback,
    onTransformMode,
    onUndo
  ]);
};
