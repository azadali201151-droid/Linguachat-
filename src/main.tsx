import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root')!;

window.onerror = function(message, source, lineno, colno, error) {
  if (message === 'Script error.' || (typeof message === 'string' && message.includes('ResizeObserver'))) {
    return true; // suppress error
  }
};

window.addEventListener('error', (e) => {
  if (e.message === 'Script error.' || e.message?.includes('ResizeObserver') || e.message?.includes('Permission denied') || e.message?.includes('NotAllowedError')) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.message?.includes('Permission denied') || e.reason?.name === 'NotAllowedError') {
    e.preventDefault();
    return;
  }
});

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
