import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { FIcon, FLogo } from '../components/futuristic';

/* ── Futuristic v2 skin · Phase 7 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. The auth flow —
   /api/auth/login call, token handling, login() + navigate — is verbatim. */

const inputStyle: CSSProperties = {
  width: '100%', padding: '12px 14px 12px 42px', fontSize: 13,
  background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
  borderRadius: 12, color: 'var(--f-text-1)', fontFamily: 'inherit', outline: 'none',
};

const inputIcon: CSSProperties = {
  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
  display: 'flex', pointerEvents: 'none',
};

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const body = { phone, password };

      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        throw new Error('Server se connect nahi ho pa raha — internet check karein aur dobara try karein');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Day 5: pass BOTH tokens — AuthContext.login persists refreshToken
      // on native (localStorage); web ignores both (httpOnly cookies set
      // by server's Set-Cookie). data.accessToken is the new field name;
      // data.token is the legacy alias for back-compat with older builds.
      login(
        data.user,
        data.accessToken ?? data.token,
        data.isTeamMember || false,
        data.refreshToken,
      );
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FLogo size={40} />
              <span className="f-display" style={{ fontSize: 22, color: 'var(--f-text-1)' }}>Dukanchi</span>
            </div>
            <h1 className="f-display" style={{ fontSize: 26, color: 'var(--f-text-1)', margin: '0 0 6px' }}>Wapas aagaye!</h1>
            <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: 0 }}>apna bazaar, apni dukaan</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <div style={inputIcon}><FIcon name="phone" size={18} color="var(--f-text-3)" /></div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
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
                  placeholder="Password"
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
                  Logging in...
                </>
              ) : (
                <>Log In <FIcon name="arrowR" size={18} color="white" /></>
              )}
            </button>
          </form>

          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: 'var(--f-text-3)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ fontWeight: 700, color: 'var(--f-orange-light)', textDecoration: 'none' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
