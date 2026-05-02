import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  const isProduction = import.meta.env.PROD;
  const isNgrok = window.location.hostname.includes('.ngrok-free.dev') ||
    window.location.hostname.includes('.ngrok.io') ||
    window.location.hostname.includes('.ngrok.app');

  // Register SW in production OR when accessed via ngrok (HTTPS)
  // Skip in localhost dev to avoid cache issues
  if (isProduction || isNgrok) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.log('SW registration failed:', err));
    });
  } else {
    // localhost dev — unregister any existing SW and clear caches
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
  }
}
