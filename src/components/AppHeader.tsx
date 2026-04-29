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
            height: 36,
            paddingLeft: 14,
            paddingRight: 14,
            borderRadius: 20,
            background: '#1A1A1A',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="Refresh"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
        <NotificationBell />
      </div>
    </div>
  );
}
