import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbench } from './features/workbench/Workbench';
import './globals.css';

if (
  process.env.NODE_ENV === 'development' &&
  new URLSearchParams(window.location.search).get('tool') === 'showcase-capture'
) {
  void import('./features/capture/showcaseTool').then(
    ({ installShowcaseCapture }) => installShowcaseCapture(window)
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('ashfox root element is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <Workbench />
  </StrictMode>
);
