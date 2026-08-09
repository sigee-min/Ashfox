'use client';

import { useEffect } from 'react';

interface WorkbenchShortcutHandlers {
  readonly onTogglePlayback: () => void;
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

export const useWorkbenchShortcuts = (
  { onTogglePlayback }: WorkbenchShortcutHandlers
): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isInteractive(event.target) || event.code !== 'Space') return;
      event.preventDefault();
      onTogglePlayback();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlayback]);
};
