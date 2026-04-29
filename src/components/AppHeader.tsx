import DukanchiLogo from './DukanchiLogo';
import NotificationBell from './NotificationBell';

export default function AppHeader() {
  return (
    <div
      className="px-4 py-3 flex justify-between items-center"
      style={{ background: 'var(--dk-bg)' }}
    >
      <div className="flex items-center gap-2.5">
        <DukanchiLogo />
        <div className="flex flex-col" style={{ gap: 1 }}>
          <span
            style={{
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: '-0.3px',
              color: 'var(--dk-text-primary)',
              lineHeight: '1.2',
            }}
          >
            Dukanchi
          </span>
          <span style={{ fontSize: 10, color: '#888', lineHeight: '1.2' }}>
            apna bazaar, apni dukaan
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.location.reload()}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1px solid var(--dk-border)',
            background: 'var(--dk-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Refresh"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="var(--dk-text-secondary)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        <NotificationBell />
      </div>
    </div>
  );
}
