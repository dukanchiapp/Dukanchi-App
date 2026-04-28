import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const DISMISS_KEY = 'pwa-dismissed';
const DISMISS_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as any).standalone === true;

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const { showToast } = useToast();
  const location = useLocation();

  useEffect(() => {
    // Already installed — don't show anything
    if (isInStandaloneMode) return;

    // iOS: show banner after a short delay (no beforeinstallprompt on iOS)
    if (isIOS) {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed || Date.now() > parseInt(dismissed) + DISMISS_DURATION) {
        const t = setTimeout(() => setShowBanner(true), 3000);
        return () => clearTimeout(t);
      }
      return;
    }

    // Android / Chrome: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed || Date.now() > parseInt(dismissed) + DISMISS_DURATION) {
        setShowBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowBanner(false);
      setShowIOSModal(true);
      return;
    }
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      showToast('Dukanchi install ho gaya!', { type: 'success' });
    }
    setShowBanner(false);
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowBanner(false);
  };

  if (['/login', '/signup', '/landing'].includes(location.pathname)) {
    return null;
  }

  return (
    <>
      {/* Install banner */}
      {showBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: 64, // above BottomNav (h-16 = 64px)
            left: 12,
            right: 12,
            zIndex: 9000,
            background: '#FF6B35',
            borderRadius: 16,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 8px 32px rgba(255,107,53,0.45)',
            animation: 'slideUp 0.3s ease',
          }}
        >
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <p style={{ color: 'white', fontSize: 13, fontWeight: 600, flex: 1, margin: 0, lineHeight: 1.4 }}>
            ⭐ Dukanchi App install karo — faster experience!
          </p>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleInstall}
              style={{ background: 'white', color: '#FF6B35', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Install Karo
            </button>
            <button
              onClick={handleDismiss}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Baad mein
            </button>
          </div>
        </div>
      )}

      {/* iOS instructions modal */}
      {showIOSModal && (
        <div
          onClick={() => setShowIOSModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 16px 32px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 20, padding: '28px 24px',
              textAlign: 'center', maxWidth: 340, width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <p style={{ fontSize: 36, marginBottom: 12 }}>📱</p>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#0D0D0D' }}>
              iOS pe install karo
            </h3>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>
              Apne iPhone mein Safari open karo, phir:
            </p>
            <div style={{ background: '#F9F6F2', borderRadius: 12, padding: '14px 16px', marginBottom: 16, textAlign: 'left' }}>
              {[
                ['1.', 'Neeche Share button tap karo ⎙'],
                ['2.', '"Add to Home Screen" select karo'],
                ['3.', '"Add" tap karo — ho gaya!'],
              ].map(([num, text]) => (
                <p key={num} style={{ fontSize: 14, color: '#374151', marginBottom: 6, display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#FF6B35', minWidth: 18 }}>{num}</span>
                  {text}
                </p>
              ))}
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              style={{
                width: '100%', background: '#FF6B35', color: 'white', border: 'none',
                borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Samajh gaya ✓
            </button>
          </div>
        </div>
      )}
    </>
  );
}
