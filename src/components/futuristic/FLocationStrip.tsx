/**
 * FLocationStrip — futuristic (v2) location bar.
 * Pin + "Showing stores near X" + Change. Adapted from the design-system
 * handoff (futuristic/screens.jsx).
 */
import { FIcon } from './FIcon';

interface FLocationStripProps {
  name: string;
  onChange: () => void;
}

export function FLocationStrip({ name, onChange }: FLocationStripProps) {
  return (
    <div
      style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'var(--f-loc-bg)',
        borderTop: '1px solid var(--f-loc-border)',
        borderBottom: '1px solid var(--f-loc-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <FIcon name="mapPin" size={14} color="#FF6BB4" />
        <span
          style={{
            fontSize: 12.5,
            color: 'var(--f-text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Showing stores near{' '}
          <strong style={{ color: 'var(--f-text-1)', fontWeight: 700 }}>{name}</strong>
        </span>
      </div>
      <button
        onClick={onChange}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#FF6BB4',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
        }}
      >
        Change
      </button>
    </div>
  );
}
