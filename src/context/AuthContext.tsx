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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && !data.error) {
          setUser(data);
          setToken("cookie"); // dummy token to pass truthiness checks
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const login = (newUser: User, newToken: string, teamMember: boolean = false) => {
    setUser(newUser);
    setToken("cookie");
    setIsTeamMember(teamMember);
    localStorage.setItem('isTeamMember', String(teamMember));
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    setToken(null);
    setIsTeamMember(false);
    localStorage.removeItem('isTeamMember');
  };

  return (
    <AuthContext.Provider value={{ user, token, isTeamMember, login, logout, isLoading }}>
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
