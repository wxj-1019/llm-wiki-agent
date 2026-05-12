import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import { stopPolling } from './stores/wikiStore';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './index.css';

let swUpdateInterval: ReturnType<typeof setInterval> | null = null;
/* Only register SW in production build — dev mode should never cache */
if ('serviceWorker' in navigator && !location.port.includes('3666') && !location.port.includes('5173') && !location.port.includes('3000')) {
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
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>
);
