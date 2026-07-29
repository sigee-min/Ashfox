import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbench } from './features/workbench/Workbench';
import './globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Ashfox root element is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <Workbench />
  </StrictMode>
);
