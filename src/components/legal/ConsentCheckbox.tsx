/**
 * ConsentCheckbox — DPDP signup consent control.
 *
 * Unticked by default (the DPDP Act requires a free, specific, informed and
 * unambiguous affirmative action — a pre-ticked box is not consent). The
 * parent signup form blocks submission until `checked` is true. The Terms
 * and Privacy links open in a new tab so half-filled signup fields survive.
 */
import type { CSSProperties } from 'react';

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const linkStyle: CSSProperties = {
  color: 'var(--f-orange-light)',
  fontWeight: 700,
  textDecoration: 'underline',
};

export function ConsentCheckbox({ checked, onChange, disabled }: ConsentCheckboxProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby="consent-text"
        style={{
          width: 18,
          height: 18,
          marginTop: 1,
          flexShrink: 0,
          accentColor: 'var(--f-magenta)',
          cursor: 'inherit',
        }}
      />
      <span id="consent-text" style={{ fontSize: 12, color: 'var(--f-text-3)', lineHeight: 1.5 }}>
        Main Dukanchi ke{' '}
        <a href="/legal/terms" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Terms of Service
        </a>{' '}
        aur{' '}
        <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Privacy Policy
        </a>{' '}
        se sehmat hoon.
      </span>
    </label>
  );
}
