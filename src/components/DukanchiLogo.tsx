/* Futuristic v3 logo tile — brand gradient + द glyph. Sized 40px to match
   the re-skinned AppHeader. Only consumed by AppHeader.tsx. */
export default function DukanchiLogo({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'var(--b-grad)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 0 18px rgba(234,154,0,0.45), inset 0 1px 0 rgba(255,255,255,0.30)',
      }}
    >
      <span style={{ color: 'white', fontSize: size * 0.5, fontWeight: 600, lineHeight: 1, textShadow: '0 0 12px rgba(234,154,0,0.7)' }}>द</span>
    </div>
  );
}
