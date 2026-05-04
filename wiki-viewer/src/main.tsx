import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './i18n';
import './index.css';

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // SW registration failed — app still works normally
  });
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found. Ensure <div id="root"></div> exists in index.html.');
}
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
