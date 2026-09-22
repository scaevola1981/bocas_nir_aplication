import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

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
