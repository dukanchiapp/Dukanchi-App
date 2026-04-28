import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Phone, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DukanchiLogo from '../components/DukanchiLogo';
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
      const response = await fetch('/api/auth/users', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, phone: trimmedPhone, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.issues && data.issues.length > 0) {
          throw new Error(data.issues[0].message);
        }
        throw new Error(data.error || 'Signup failed');
      }

      login(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] relative overflow-hidden">
      <div className="w-full max-w-md px-6 py-12 relative z-10">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20">
          
          <div className="flex flex-col items-center text-center mb-10">
            <div className="flex items-center gap-3 mb-4">
              <DukanchiLogo />
              <span className="text-xl font-bold tracking-tight text-gray-900">Dukanchi</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1.5">
              Shuru karte hain!
            </h1>
            <p className="text-gray-500 text-sm">Aapka local market, ab aapke haath mein</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start">
               <span className="font-semibold mr-2">Error:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-4">
            <div>
              <label htmlFor="account-type" className="block text-sm font-medium text-gray-700 mb-1">Hi, please select your profile.</label>
              <select
                id="account-type"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent transition-all outline-none text-sm text-gray-900"
              >
                <option value="customer">Customer</option>
                <option value="retailer">Retail Shop</option>
                <option value="supplier">Supplier</option>
                <option value="brand">Brand</option>
                <option value="manufacturer">Manufacturer</option>
              </select>
            </div>
            
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  placeholder="Full Name *"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Phone size={20} />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  placeholder="Phone Number *"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  placeholder="Password *"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center bg-[#FF6B35] text-white font-medium py-3.5 rounded-full hover:bg-[#E85D2A] disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF6B35] transition-all duration-200 shadow-lg shadow-[#FF6B35]/20 group"
            >
              {isLoading ? 'Signing Up...' : 'Sign Up'}
              {!isLoading && <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#FF6B35] hover:text-[#E85D2A] transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
