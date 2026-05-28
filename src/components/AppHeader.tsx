import DukanchiLogo from './DukanchiLogo';
import NotificationBell from './NotificationBell';

/* ── Futuristic v3 skin · Session 117 / feat/reskin-header-nav ──
   Dark-glass top bar: logo tile + wordmark + NotificationBell. The v2
   Refresh button (which did a brute window.location.reload()) is removed
   per the design handoff — feed freshness comes from socket updates +
   navigation, not a manual header reload.

   NOTE: this shared AppHeader is currently NOT mounted by any screen —
   Home/Search/Map/Messages render their own inline headers. It is restyled
   here to the v3 spec so it's ready if/when a shared header is wired; the
   actually-visible per-page headers get re-skinned in their own screen
   sessions. NotificationBell wiring (drawer) preserved verbatim. */

export default function AppHeader() {
  return (
    <div
      className="px-5 py-3.5 flex justify-between items-center"
      style={{
        background: 'var(--f-sticky-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex items-center" style={{ gap: 12 }}>
        <DukanchiLogo size={40} />
        <div className="flex flex-col" style={{ gap: 2 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--f-text-1)',
              lineHeight: 1.1,
            }}
          >
            Dukanchi
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--f-text-3)', lineHeight: 1.1 }}>
            apna bazaar, apni dukaan
          </span>
        </div>
      </div>
      {/* Bell tile — 44×44 glass; NotificationBell owns the unread dot + drawer */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: 'var(--f-glass-bg-2)',
          border: '1px solid var(--f-glass-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <NotificationBell />
      </div>
    </div>
  );
}
