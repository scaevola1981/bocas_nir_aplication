import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Înregistrare Service Worker pentru instalare PWA pe Desktop (compatibil cu GitHub Pages, Vercel și localhost)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).then((reg) => {
      console.log('Service Worker înregistrat cu succes:', reg.scope);
    }).catch((err) => {
      console.error('Eroare înregistrare Service Worker:', err);
    });
  });
}
