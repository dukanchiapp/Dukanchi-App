import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { captureEvent } from '../lib/posthog';
import { FIcon, FLogo } from '../components/futuristic';

/* ── Futuristic v2 skin · Phase 7 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. The auth flow —
   field validation, /api/auth/users call, PostHog event, login() +
   navigate — is preserved verbatim. */

const inputStyle: CSSProperties = {
  width: '100%', padding: '12px 14px 12px 42px', fontSize: 13,
  background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
  borderRadius: 12, color: 'var(--f-text-1)', fontFamily: 'inherit', outline: 'none',
};

const inputIcon: CSSProperties = {
  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
  display: 'flex', pointerEvents: 'none',
};

const optStyle: CSSProperties = { background: '#0E1224', color: '#F4F2EB' };

export default function SignupPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate mandatory fields
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) { setError('Full name is required.'); return; }
    if (!trimmedPhone) { setError('Phone number is required.'); return; }
    if (!password) { setError('Password is required.'); return; }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, phone: trimmedPhone, password, role }),
      });

      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        throw new Error('Server se connect nahi ho pa raha — internet check karein aur dobara try karein');
      }

      if (!response.ok) {
        if (data.issues && data.issues.length > 0) {
          throw new Error(data.issues[0].message);
        }
        throw new Error(data.error || 'Signup failed');
      }

      // PostHog: user_signed_up fires BEFORE login() so the event is
      // captured against the anonymous distinct_id, then login()'s
      // identify() promotes that anonymous user to the real userId.
      captureEvent('user_signed_up', { role });
      // Day 5: pass refreshToken so native persists both tokens.
      login(data.user, data.accessToken ?? data.token, false, data.refreshToken);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="f-bg-aurora"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', fontFamily: 'var(--f-font)' }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div className="f-glass f-glass-edge" style={{ borderRadius: 28, padding: 32, background: 'var(--f-glass-bg)' }}>

          {/* Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FLogo size={40} />
              <span className="f-display" style={{ fontSize: 22, color: 'var(--f-text-1)' }}>Dukanchi</span>
            </div>
            <h1 className="f-display" style={{ fontSize: 26, color: 'var(--f-text-1)', margin: '0 0 6px' }}>Shuru karte hain!</h1>
            <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: 0 }}>Aapka local market, ab aapke haath mein</p>
          </div>

          {error && (
            <div style={{
              marginBottom: 20, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 8,
              background: 'rgba(255,77,106,0.12)', border: '1px solid rgba(255,77,106,0.35)', borderRadius: 12,
              fontSize: 13, color: '#FF8FA3',
            }}>
              <FIcon name="alert" size={15} color="#FF8FA3" />
              <span><span style={{ fontWeight: 700, marginRight: 4 }}>Error:</span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="account-type" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--f-text-2)', marginBottom: 6 }}>
                  Hi, please select your profile.
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    id="account-type"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 38px 12px 14px', fontSize: 13, background: 'var(--f-glass-bg)',
                      border: '1px solid var(--f-glass-border)', borderRadius: 12, color: 'var(--f-text-1)',
                      fontFamily: 'inherit', outline: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="customer" style={optStyle}>Customer</option>
                    <option value="retailer" style={optStyle}>Retail Shop</option>
                    <option value="supplier" style={optStyle}>Supplier</option>
                    <option value="brand" style={optStyle}>Brand</option>
                    <option value="manufacturer" style={optStyle}>Manufacturer</option>
                  </select>
                  <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
                    <FIcon name="chevD" size={16} color="var(--f-text-3)" />
                  </div>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={inputIcon}><FIcon name="user" size={18} color="var(--f-text-3)" /></div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name *"
                  style={inputStyle}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <div style={inputIcon}><FIcon name="phone" size={18} color="var(--f-text-3)" /></div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone Number *"
                  style={inputStyle}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <div style={inputIcon}><FIcon name="lock" size={18} color="var(--f-text-3)" /></div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password *"
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 13, borderRadius: 9999, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                background: 'var(--f-grad-primary)', color: 'white', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                boxShadow: '0 0 24px rgba(255,107,53,0.40)', opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                  Signing Up...
                </>
              ) : (
                <>Sign Up <FIcon name="arrowR" size={18} color="white" /></>
              )}
            </button>
          </form>

          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: 'var(--f-text-3)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 700, color: 'var(--f-orange-light)', textDecoration: 'none' }}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
