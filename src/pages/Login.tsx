import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { captureEvent } from '../lib/posthog';
import { FIcon, FLogo } from '../components/futuristic';
import { ConsentCheckbox } from '../components/legal/ConsentCheckbox';

const inputStyle: CSSProperties = {
  width: '100%', padding: '12px 14px 12px 42px', fontSize: 13,
  background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
  borderRadius: 12, color: 'var(--f-text-1)', fontFamily: 'inherit', outline: 'none',
};

const inputIcon: CSSProperties = {
  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
  display: 'flex', pointerEvents: 'none',
};

const optStyle: CSSProperties = { background: '#FFFFFF', color: '#1C1A18' };

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'login' | 'signup'>('phone');
  
  // Shared state
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Signup specific state
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [consent, setConsent] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) { setError('Phone number is required.'); return; }
    
    setIsLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to check phone');
      
      if (data.exists) {
        setStep('login');
      } else {
        setStep('signup');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        throw new Error('Server se connect nahi ho pa raha — internet check karein aur dobara try karein');
      }

      if (!response.ok) throw new Error(data.error || 'Login failed');

      login(
        data.user,
        data.accessToken ?? data.token,
        data.isTeamMember || false,
        data.refreshToken,
      );

      if (data.user.role === 'admin') {
        window.location.replace('/admin-panel/');
        return;
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) { setError('Full name is required.'); return; }
    if (!trimmedPhone) { setError('Phone number is required.'); return; }
    if (!password) { setError('Password is required.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!consent) { setError('Aage badhne ke liye Terms aur Privacy Policy accept karein.'); return; }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, phone: trimmedPhone, password, role, consent: true }),
      });

      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        throw new Error('Server se connect nahi ho pa raha — internet check karein aur dobara try karein');
      }

      if (!response.ok) {
        if (data.issues && data.issues.length > 0) throw new Error(data.issues[0].message);
        throw new Error(data.error || 'Signup failed');
      }

      captureEvent('user_signed_up', { role });
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FLogo size={40} />
              <span className="f-display" style={{ fontSize: 22, color: 'var(--f-text-1)' }}>Dukanchi</span>
            </div>
            <h1 className="f-display" style={{ fontSize: 26, color: 'var(--f-text-1)', margin: '0 0 6px' }}>
              {step === 'phone' ? 'Welcome!' : step === 'login' ? 'Wapas aagaye!' : 'Shuru karte hain!'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: 0 }}>apna bazaar, apni dukaan</p>
          </div>

          {error && (
            <div style={{
              marginBottom: 20, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 8,
              background: 'rgba(229,57,53,0.10)', border: '1px solid rgba(229,57,53,0.30)', borderRadius: 12,
              fontSize: 13, color: 'var(--f-danger)',
            }}>
              <FIcon name="alert" size={15} color="var(--f-danger)" />
              <span><span style={{ fontWeight: 700, marginRight: 4 }}>Error:</span>{error}</span>
            </div>
          )}

          {/* Phone Step */}
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: 13, borderRadius: 9999, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                  background: 'var(--c-action)', color: 'var(--c-action-ink)', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
                  boxShadow: '0 6px 18px rgba(12,131,31,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                    Checking...
                  </>
                ) : (
                  <>Continue <FIcon name="arrowR" size={18} color="white" /></>
                )}
              </button>
            </form>
          )}

          {/* Login Step */}
          {step === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <div style={inputIcon}><FIcon name="phone" size={18} color="var(--f-text-3)" /></div>
                  <input type="tel" disabled value={phone} style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }} />
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--f-orange-light)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                  >
                    Edit
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={inputIcon}><FIcon name="lock" size={18} color="var(--f-text-3)" /></div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--f-text-3)' }}
                  >
                    <FIcon name={showPassword ? "eyeOff" : "eye"} size={18} color="currentColor" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: 13, borderRadius: 9999, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                  background: 'var(--c-action)', color: 'var(--c-action-ink)', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
                  boxShadow: '0 6px 18px rgba(12,131,31,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', opacity: isLoading ? 0.7 : 1,
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
          )}

          {/* Signup Step */}
          {step === 'signup' && (
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                <div>
                  <label htmlFor="account-type" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--f-text-2)', marginBottom: 6 }}>
                    Select Category
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
                  <input type="tel" disabled value={phone} style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }} />
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--f-orange-light)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                  >
                    Edit
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={inputIcon}><FIcon name="lock" size={18} color="var(--f-text-3)" /></div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set New Password *"
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--f-text-3)' }}
                  >
                    <FIcon name={showPassword ? "eyeOff" : "eye"} size={18} color="currentColor" />
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={inputIcon}><FIcon name="lock" size={18} color="var(--f-text-3)" /></div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password *"
                    style={inputStyle}
                  />
                </div>
              </div>

              <ConsentCheckbox checked={consent} onChange={setConsent} disabled={isLoading} />

              <button
                type="submit"
                disabled={isLoading || !consent}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: 13, borderRadius: 9999, border: 'none', cursor: (isLoading || !consent) ? 'not-allowed' : 'pointer',
                  background: 'var(--c-action)', color: 'var(--c-action-ink)', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
                  boxShadow: '0 6px 18px rgba(12,131,31,0.32), inset 0 1px 0 rgba(255,255,255,0.18)', opacity: (isLoading || !consent) ? 0.7 : 1,
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
          )}

        </div>
      </div>
    </div>
  );
}
