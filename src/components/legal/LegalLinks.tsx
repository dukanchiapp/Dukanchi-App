/**
 * LegalLinks — the five public DPDP document links.
 *
 * One source of truth for the /legal/* routes, rendered in two shapes:
 *  - variant="menu"   → a Profile-style glass list (logged-in surfaces)
 *  - variant="footer" → a compact inline link row (landing / marketing)
 */
import { Link } from 'react-router-dom';
import { FIcon } from '../futuristic';
import type { FIconName } from '../futuristic';

interface LegalLink {
  to: string;
  label: string;
  icon: FIconName;
}

export const LEGAL_LINKS: readonly LegalLink[] = [
  { to: '/legal/privacy', label: 'Privacy Policy', icon: 'shield' },
  { to: '/legal/terms', label: 'Terms of Service', icon: 'fileText' },
  { to: '/legal/account-deletion', label: 'Account Deletion', icon: 'trash' },
  { to: '/legal/grievance', label: 'Grievance Redressal', icon: 'help' },
  { to: '/legal/cookies', label: 'Cookie Policy', icon: 'fileText' },
] as const;

interface LegalLinksProps {
  variant: 'menu' | 'footer';
}

export function LegalLinks({ variant }: LegalLinksProps) {
  if (variant === 'menu') {
    return (
      <div
        className="f-glass"
        style={{ borderRadius: 18, marginBottom: 16, background: 'var(--f-glass-bg)', overflow: 'hidden' }}
      >
        {LEGAL_LINKS.map((link, i) => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              textDecoration: 'none',
              borderBottom: i < LEGAL_LINKS.length - 1 ? '1px solid var(--f-glass-border)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FIcon name={link.icon} size={18} color="var(--f-text-3)" />
              <span style={{ fontSize: 14, color: 'var(--f-text-1)' }}>{link.label}</span>
            </div>
            <FIcon name="chevR" size={16} color="var(--f-text-3)" />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <nav
      aria-label="Legal"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '8px 14px',
      }}
    >
      {LEGAL_LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          style={{ fontSize: 11, color: 'var(--f-text-3)', textDecoration: 'none' }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
