/**
 * FAppHeader — glass top bar with logo + live-signal pill.
 * Adapted from the design-system handoff (futuristic/components.jsx).
 */
import { FLogo } from './FLogo';
import { FIcon } from './FIcon';

interface FAppHeaderProps {
  location?: string;
  signalCount?: number;
}

export function FAppHeader({
  location = 'Andheri West',
  signalCount = 12,
}: FAppHeaderProps) {
  return (
    <div
      style={{
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FLogo size={36} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            Dukanchi
          </span>
          <span
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            spatial commerce
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px 6px 8px',
          borderRadius: 9999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#2EE7A1',
            boxShadow: '0 0 10px #2EE7A1',
          }}
        />
        <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>
          {signalCount} live
        </span>
        <span
          style={{
            width: 1,
            height: 12,
            background: 'rgba(255,255,255,0.18)',
            margin: '0 2px',
          }}
        />
        <FIcon name="mapPin" size={11} color="rgba(255,255,255,0.6)" />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
          {location}
        </span>
      </div>
    </div>
  );
}
