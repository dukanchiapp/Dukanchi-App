export default function RefreshButton() {
  return (
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
        flexShrink: 0,
      }}
      aria-label="Refresh"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      Refresh
    </button>
  );
}
