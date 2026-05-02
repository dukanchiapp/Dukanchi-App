import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isTeamMember: boolean;
  login: (user: User, token: string, isTeamMember?: boolean) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        if (data && !data.error && data.id) {
          setUser(data);
          setToken("cookie");
          const wasTeamMember = localStorage.getItem('isTeamMember') === 'true';
          setIsTeamMember(wasTeamMember);
        }
      })
      .catch(err => {
        if (!cancelled) console.error('[AUTH] /me failed:', err);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    return () => { cancelled = true; };
  }, []);

  const login = (newUser: User, newToken: string, teamMember: boolean = false) => {
    setUser(newUser);
    setToken("cookie");
    setIsTeamMember(teamMember);
    localStorage.setItem('isTeamMember', String(teamMember));
    setAuthChecked(true);
  };

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    setToken(null);
    setIsTeamMember(false);
    localStorage.removeItem('isTeamMember');
  };

  return (
    <AuthContext.Provider value={{ user, token, isTeamMember, login, logout, isLoading: !authChecked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
