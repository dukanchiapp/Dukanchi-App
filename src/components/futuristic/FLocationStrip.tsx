/**
 * FLocationStrip — futuristic (v2) location bar.
 * Rounded glass pill: 📍 "{area} nearby" + Change.
 * Adapted from the design-system handoff (futuristic/screens.jsx).
 */
interface FLocationStripProps {
  name: string;
  onChange: () => void;
}

export function FLocationStrip({ name, onChange }: FLocationStripProps) {
  return (
    <div style={{ padding: '6px 16px 10px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
          borderRadius: 9999,
          background: 'var(--f-loc-bg)',
          border: '1px solid var(--f-loc-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, flexShrink: 0 }}>📍</span>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--f-text-1)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name} nearby
          </span>
        </div>
        <button
          onClick={onChange}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--f-orange)',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          Change
        </button>
      </div>
    </div>
  );
}
