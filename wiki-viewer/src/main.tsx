import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { stopPolling } from './stores/wikiStore';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './index.css';

let swUpdateInterval: ReturnType<typeof setInterval> | null = null;
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        swUpdateInterval = setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });
}
window.addEventListener('beforeunload', () => {
  if (swUpdateInterval) clearInterval(swUpdateInterval);
});

// Cleanup ETag polling on page unload
window.addEventListener('beforeunload', stopPolling);

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found. Ensure <div id="root"></div> exists in index.html.');
}
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
