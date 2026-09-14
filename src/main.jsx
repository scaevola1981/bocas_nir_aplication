import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { App } from './App';
import './index.css';

// Inițializare Sentry Error Monitoring & Crash Reporting
Sentry.init({
  dsn: "https://9302e9ea7bc37fc2b798f0adfdb51fdc@o4512083459440640.ingest.de.sentry.io/4512083472613456",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true, // Protecție GDPR / Confidențialitate financiară
      blockAllMedia: true,
    }),
  ],
  // Rata de eșantionare a performanței și erorilor
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE || 'production',
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Înregistrare Service Worker pentru instalare PWA pe Desktop (atât pe localhost cât și în producție)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('Service Worker înregistrat cu succes:', reg.scope);
    }).catch((err) => {
      console.error('Eroare înregistrare Service Worker:', err);
    });
  });
}
