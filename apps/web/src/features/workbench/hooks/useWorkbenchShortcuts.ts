'use client';

import { useEffect } from 'react';

interface WorkbenchShortcutHandlers {
  onUndo: () => void;
  onRedo: () => void;
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
    onUndo
  ]);
};
