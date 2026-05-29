/**
 * FLocationStrip — futuristic location bar.
 * Production match (handoff screens.jsx FLocationStrip): full-width strip with
 * 📍 "Showing stores near {name}" + Change.
 *
 * Session 126.3: re-skinned to the handoff EXACTLY — copy is now
 * "Showing stores near <strong>{name}</strong>" (was the drifted v2
 * "{name} nearby" pill). Pin + Change → #D11F75. Values copied verbatim from
 * screens.jsx lines 95-110. Prop contract (name, onChange) unchanged.
 */
import { MapPin } from 'lucide-react';

interface FLocationStripProps {
  name: string;
  onChange: () => void;
}

export function FLocationStrip({ name, onChange }: FLocationStripProps) {
  return (
    <div
      style={{
        padding: '11px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'var(--f-loc-bg)',
        borderTop: '1px solid var(--f-loc-border)',
        borderBottom: '1px solid var(--f-loc-bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <MapPin size={14} color="#D11F75" style={{ flexShrink: 0 }} />
        <span
          style={{
            fontSize: 13,
            color: 'var(--f-text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          Showing stores near <strong style={{ color: 'var(--f-text-1)', fontWeight: 700 }}>{name}</strong>
        </span>
      </div>
      <button
        onClick={onChange}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#D11F75',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          flexShrink: 0,
          padding: '4px 0',
        }}
      >
        Change
      </button>
    </div>
  );
}
