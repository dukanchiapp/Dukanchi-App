import React from 'react';

const PWARefreshButton: React.FC = () => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                    || (window.navigator as any).standalone === true;
  
  if (!isStandalone) return null;

  return (
    <button
      onClick={() => window.location.reload()}
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '16px',
        width: '40px',
        height: '40px',
        backgroundColor: 'white',
        borderRadius: '50%',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        opacity: 0.7,
        zIndex: 9999
      }}
      aria-label="Refresh application"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2v6h-6"></path>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
      </svg>
    </button>
  );
};

export default PWARefreshButton;
