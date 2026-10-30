import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { BillingDraftProvider } from './context/BillingDraftContext';
import { initLiveSyncEngine } from './firebase/liveSync';

// Enable automatic real-time live sync between Dexie and Firebase Cloud
initLiveSyncEngine();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BillingDraftProvider>
      <App />
    </BillingDraftProvider>
  </React.StrictMode>
);

