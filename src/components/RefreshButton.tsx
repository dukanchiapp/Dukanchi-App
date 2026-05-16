/* Futuristic v2 skin · Phase 10 / feat/futuristic-redesign. */
export default function RefreshButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      style={{
        height: 34,
        paddingLeft: 13,
        paddingRight: 13,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        flexShrink: 0,
        fontFamily: 'var(--f-font)',
        background: 'var(--f-glass-bg-2)',
        color: 'var(--f-text-1)',
        border: '1px solid var(--f-glass-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
      aria-label="Refresh"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      Refresh
    </button>
  );
}
